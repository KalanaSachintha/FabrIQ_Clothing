# Backend Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the application
CMD ["node", "app.js"]
