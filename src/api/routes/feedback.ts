import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', async (req, res) => {
  const { name, rating, comment, userId } = req.body;
  try {
    await prisma.feedback.create({
      data: {
        name,
        rating,
        comment,
        user: userId ? { connect: { id: userId } } : undefined,
      },
    });
    res.status(200).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

export default router;