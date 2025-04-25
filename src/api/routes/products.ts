import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get featured products
router.get('/featured', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      take: 5, // Limit to 5
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            averageRating: true,
            county: true,
          },
        },
      },
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch featured products' });
  }
});

export default router;