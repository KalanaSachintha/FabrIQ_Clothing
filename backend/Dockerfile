# Backend Dockerfile
FROM node:20

# Install python and necessary system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# Install python libraries for forecasting
# Using --break-system-packages because we are in a container and it's easier than setting up a venv
RUN pip3 install --no-cache-dir \
    pandas \
    pymongo \
    scikit-learn \
    numpy \
    --break-system-packages

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
