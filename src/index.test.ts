import plugin from "src";
import { createServer, ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, it } from 'vitest';

const SERVER_PORT = 3000;
const BASE_URL = `http://localhost:${SERVER_PORT}/`;
let server: ViteDevServer;

beforeAll(async () => {
    server = await createServer({
        plugins: [
            plugin()
        ]
    });
    await server.listen(SERVER_PORT);
});

afterAll(async () => {
    await server.close();
});

describe('Test', async () => {
    it('coverage result', async () => {
    })
});