import { Router } from 'express';
import { escrowService } from '../services/escrow.service.js';
import { attachmentService } from '../services/attachment.service.js';
import { cantonTrafficService } from '../services/canton-traffic.service.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, Escrow, EscrowWithParties, EscrowEvent, EscrowMessage, CreateEscrowRequest } from '../types/index.js';

const router = Router();

// Create new escrow
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const request: CreateEscrowRequest = req.body;

    if (!request.serviceTypeId || !request.amount) {
      return res.status(400).json({
        success: false,
        error: 'serviceTypeId and amount are required',
      });
    }

    // Validate traffic buy metadata if applicable
    if (request.serviceTypeId === 'TRAFFIC_BUY') {
      if (!request.metadata || !cantonTrafficService.validateMetadata(request.metadata)) {
        return res.status(400).json({
          success: false,
          error: 'Traffic buy requires validatorPartyId and trafficAmountBytes in metadata',
        });
      }
    }

    const escrow = await escrowService.createEscrow(userId, request);

    // Check for auto-accept
    await escrowService.checkAutoAccept(escrow.id);

    // Refresh escrow state
    const updatedEscrow = await escrowService.getEscrowById(escrow.id);

    const response: ApiResponse<EscrowWithParties> = {
      success: true,
      data: updatedEscrow!,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get escrow by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const escrow = await escrowService.getEscrowById(id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    const response: ApiResponse<EscrowWithParties> = {
      success: true,
      data: escrow,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get user's escrows
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const status = req.query.status as string | undefined;

    const escrows = await escrowService.getEscrowsForUser(userId, status as any);

    const response: ApiResponse<Escrow[]> = {
      success: true,
      data: escrows,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get pending escrows for provider
router.get('/provider/pending', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const serviceTypeId = req.query.serviceTypeId as string | undefined;

    const escrows = await escrowService.getPendingEscrowsForProvider(userId, serviceTypeId);

    const response: ApiResponse<Escrow[]> = {
      success: true,
      data: escrows,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Accept escrow (provider)
router.post('/:id/accept', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const escrow = await escrowService.acceptEscrow(id, userId);

    const response: ApiResponse<Escrow> = {
      success: true,
      data: escrow,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Fund escrow
router.post('/:id/fund', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { notes } = req.body;

    const escrow = await escrowService.fundEscrow(id, userId);

    // If traffic buy, create traffic request
    if (escrow.serviceTypeId === 'TRAFFIC_BUY' && escrow.metadata) {
      await cantonTrafficService.createTrafficRequest(escrow.id, escrow.metadata as any);
    }

    // Add notes as a message if provided
    if (notes && typeof notes === 'string' && notes.trim()) {
      await escrowService.addMessage(id, userId, `[Funding Notes] ${notes.trim()}`);
    }

    const response: ApiResponse<Escrow> = {
      success: true,
      data: escrow,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Confirm escrow completion
router.post('/:id/confirm', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { notes } = req.body;

    // Get current escrow to determine confirmation type
    const currentEscrow = await escrowService.getEscrowById(id);
    const confirmationType = currentEscrow?.status === 'FUNDED' ? 'Delivery' : 'Receipt';

    const escrow = await escrowService.confirmEscrow(id, userId);

    // Add notes as a message if provided
    if (notes && typeof notes === 'string' && notes.trim()) {
      await escrowService.addMessage(id, userId, `[${confirmationType} Confirmation Notes] ${notes.trim()}`);
    }

    // If completed and traffic buy, execute traffic purchase
    if (escrow.status === 'COMPLETED' && escrow.serviceTypeId === 'TRAFFIC_BUY') {
      const trafficRequest = await cantonTrafficService.getTrafficRequestByEscrowId(escrow.id);
      if (trafficRequest && !trafficRequest.executedAt) {
        try {
          await cantonTrafficService.executeTrafficPurchase(trafficRequest.id);
        } catch (trafficError) {
          console.error('Traffic purchase execution failed:', trafficError);
          // Don't fail the escrow confirmation, just log the error
        }
      }
    }

    // If completed, release all attachments (including escrowed ones)
    if (escrow.status === 'COMPLETED') {
      await attachmentService.releaseAllForEscrow(escrow.id);
    }

    const response: ApiResponse<Escrow> = {
      success: true,
      data: escrow,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Cancel escrow
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { reason } = req.body;

    const escrow = await escrowService.cancelEscrow(id, userId, reason);

    const response: ApiResponse<Escrow> = {
      success: true,
      data: escrow,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Get escrow events
router.get('/:id/events', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const events = await escrowService.getEscrowEvents(id);

    const response: ApiResponse<EscrowEvent[]> = {
      success: true,
      data: events,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get escrow attachments
router.get('/:id/attachments', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await attachmentService.getAttachmentsForEscrow(id);

    const response: ApiResponse<typeof attachments> = {
      success: true,
      data: attachments,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================
// ESCROW MESSAGES
// ============================================

// Get messages for an escrow
router.get('/:id/messages', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await escrowService.getMessages(id);

    const response: ApiResponse<EscrowMessage[]> = {
      success: true,
      data: messages,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Add a message to an escrow
router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    const newMessage = await escrowService.addMessage(id, userId, message.trim());

    const response: ApiResponse<EscrowMessage> = {
      success: true,
      data: newMessage,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

export default router;
