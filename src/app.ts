import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './api/routes/auth';
import userRouter from './api/routes/user';
import feedbackRouter from './api/routes/feedback';
import ratingRouter from './api/routes/ratings';
import { errorHandler } from './api/middleware/errorHandler';
import { auditMiddleware } from './api/middleware/audit';
import productRouter from './api/routes/products';
import { logger } from './config/logger';



const app = express();

// Middleware
app.use(cors()); // Enable CORS for frontend
app.use(helmet()); // Secure HTTP headers
app.use(express.json()); // Parse JSON bodies
app.use(auditMiddleware); // Log all requests


// Routes
app.use('/api/auth', authRouter); // Authentication routes (login, signup, password reset)
app.use('/api/user', userRouter); // User profile routes
app.use('/api/feedback', feedbackRouter); // Feedback submission routes
app.use('/api/ratings', ratingRouter); // Farmer ratings routes
app.use('/api/products', productRouter);


// Error handling
app.use(errorHandler);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));