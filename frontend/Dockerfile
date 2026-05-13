# Build stage
FROM node:20-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Final stage: Serve via Nginx
FROM nginx:alpine
# Copy the built files from the build stage to Nginx's HTML directory
COPY --from=build-stage /app/build /usr/share/nginx/html
# Expose port 80 (standard HTTP)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
