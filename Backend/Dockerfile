# Use Node.js LTS Alpine image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/temp

# Expose port (Railway will set PORT env var dynamically)
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
