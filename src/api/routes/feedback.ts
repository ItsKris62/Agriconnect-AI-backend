import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { validate } from '../middleware/validate';
import { optionalAuthenticate, AuthenticatedRequest } from '../middleware/auth';
import { feedbackRateLimiter } from '../middleware/rateLimit';
import { logEvent } from '../middleware/audit';
import { HTTP_STATUS, EVENT_ACTIONS } from '../../utils/constants';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const feedbackSchema = z.object({
  name: z.string().min(1).optional(), // Keep optional for anonymous feedback
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000), // Add a max length for the comment
});

// Submit feedback
router.post('/', feedbackRateLimiter, optionalAuthenticate, validate(feedbackSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { name, rating, comment } = req.body;
  const userId = req.user?.id;

  // If user is authenticated, we don't necessarily need the 'name' from the body
  // We can rely on the userId. If anonymous, 'name' might be required or allowed.
  // Let's adjust the logic slightly:
  let feedbackName = name;
  if (userId && !name) {
      // Optionally fetch user's name if not provided and user is logged in
      // const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      // feedbackName = user ? `${user.firstName} ${user.lastName}` : 'Authenticated User';
      // Or just leave name null/undefined if not provided, relying on userId link
      feedbackName = undefined; // Let the DB handle null if name is optional and user is logged in
  } else if (!userId && !name) {
      // If anonymous feedback requires a name, enforce it here or in the schema conditionally
      // For now, we allow fully anonymous feedback without a name if not logged in.
  }


  try {
      const feedback = await prisma.feedback.create({
          data: {
              userId: userId, // Link to user if authenticated
              name: feedbackName, // Use the determined name (could be null/undefined)
              rating,
              comment,
          },
      });

      // Use a defined constant for the action
      await logEvent(userId, EVENT_ACTIONS.FEEDBACK_SUBMITTED, 'FEEDBACK', feedback.id, { ip: req.ip, rating: feedback.rating });

      res.status(HTTP_STATUS.CREATED).json({ message: "Feedback submitted successfully.", feedbackId: feedback.id });
      // Avoid sending the full feedback object back unless necessary
      // res.status(HTTP_STATUS.CREATED).json(feedback);

  } catch (error) {
      console.error("Failed to submit feedback:", error);
      // Log appropriately
      await logEvent(userId, EVENT_ACTIONS.FEEDBACK_SUBMITTED, 'FEEDBACK', null, { ip: req.ip, error: 'Submission failed' });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Failed to submit feedback." });
  }
});

export default router;