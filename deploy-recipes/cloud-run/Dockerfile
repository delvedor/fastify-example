# use an alpine distribution to reduce the image size
FROM node:14-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Use `npm ci` instead of `npm i` for reliable builds
RUN npm ci --only=production

COPY . .

# use `node index.js` instead of `npm start` provides a faster startup
CMD [ "node", "index.js" ]
