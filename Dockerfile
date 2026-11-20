# Đảo Đèn Lồng — web game server + headless tools.
#   docker build -t dao-den-long .
#   docker run --rm -p 5173:5173 dao-den-long                       # play at http://localhost:5173
#   docker run --rm -v "$PWD:/out" dao-den-long node src/headless.js --seed 1 --night 1 --ticks 600 --out /out/out.jsonl
#   docker run --rm -v "$PWD:/out" dao-den-long node --expose-gc scripts/soak.js --seed 7 --nights 10 --out /out/soak.json
# (bench needs a real browser window, so run it on the host: node scripts/bench.js ...)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=5173
EXPOSE 5173
CMD ["node", "scripts/serve.js"]
