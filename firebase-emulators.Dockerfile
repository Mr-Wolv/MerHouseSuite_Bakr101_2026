FROM node:20-slim
RUN npm install -g firebase-tools@15.20.0
WORKDIR /workspace
