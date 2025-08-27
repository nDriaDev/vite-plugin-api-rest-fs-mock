<div align="left" class="">
<h1>VITE-PLUGIN-API-REST-FS-MOCK</h1>
<p><em>Seamless Mock APIs, Accelerate Your Development Journey</em></p>

<img alt="last-commit" src="https://img.shields.io/github/last-commit/nDriaDev/vite-plugin-api-rest-fs-mock?style=flat&amp;logo=git&amp;logoColor=white&amp;color=0080ff" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="repo-top-language" src="https://img.shields.io/github/languages/top/nDriaDev/vite-plugin-api-rest-fs-mock?style=flat&amp;color=0080ff" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="repo-language-count" src="https://img.shields.io/github/languages/count/nDriaDev/vite-plugin-api-rest-fs-mock?style=flat&amp;color=0080ff" class="inline-block mx-1" style="margin: 0px 2px;">
<p><em>Built with the tools and technologies:</em></p>
<img alt="JSON" src="https://img.shields.io/badge/JSON-000000.svg?style=flat&amp;logo=JSON&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="Markdown" src="https://img.shields.io/badge/Markdown-000000.svg?style=flat&amp;logo=Markdown&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="npm" src="https://img.shields.io/badge/npm-CB3837.svg?style=flat&amp;logo=npm&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&amp;logo=JavaScript&amp;logoColor=black" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18.svg?style=flat&amp;logo=Vitest&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<br>
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&amp;logo=TypeScript&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF.svg?style=flat&amp;logo=Vite&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="ESLint" src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat&amp;logo=ESLint&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
<img alt="YAML" src="https://img.shields.io/badge/YAML-CB171E.svg?style=flat&amp;logo=YAML&amp;logoColor=white" class="inline-block mx-1" style="margin: 0px 2px;">
</div>

# vite-plugin-api-rest-fs-mock
Plugin for a mock REST and File-based API integrated in Vite server.


# vite-plugin-api-rest-fs-mock


A powerful Vite plugin to create mock REST and file-based APIs directly within your Vite development server. Accelerate your frontend development by simulating backend behavior without writing a separate server. This plugin allows you to serve static files from your file system, define custom handlers for dynamic responses, and simulate complex API logic with ease.

## Features

*   **File-System Based Mocking**: Automatically serve and manipulate mock data from a local directory, mapping request paths to file paths.
*   **Full REST Support**: Handles `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests for both file-based and custom handlers.
*   **Powerful Path Matching**: Uses Ant-style path patterns (e.g., `/users/**`, `/items/{id}`) for flexible routing.
*   **Advanced FS Features**:
    *   Built-in pagination and filtering for JSON array responses.
    *   Automatic lookup of `index.json` for directory requests.
    *   `preHandle` and `postHandle` hooks for FS-based responses.
*   **Customizable Handlers**: Define custom functions to handle complex requests and generate dynamic responses.
*   **Middleware Support**: Use Express-like middlewares for request pre-processing, authentication, or logging.
*   **Configurable Request Parsing**: Built-in support for parsing JSON, URL-encoded, and multipart/form-data bodies.
*   **Development Utilities**: Simulate network latency with `delay` and server issues with `gatewayTimeout`.
*   **Detailed Logging**: Choose between `info`, `warn`, `error`, and `debug` log levels for easy debugging.

## Installation

```bash
# pnpm
pnpm add -D @ndriadev/vite-plugin-api-rest-fs-mock

# npm
npm install -D @ndriadev/vite-plugin-api-rest-fs-mock

# yarn
yarn add -D @ndriadev/vite-plugin-api-rest-fs-mock
```

## Usage

Add the plugin to your `vite.config.ts` file.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import mockApi from '@ndriadev/vite-plugin-api-rest-fs-mock';

export default defineConfig({
  plugins: [
    mockApi({
      // Plugin options go here
    }),
  ],
});
```

### File-System Based Mocking

This is the simplest way to get started. Create a directory for your mocks and point the plugin to it.

1.  **Configure the plugin:**
    ```typescript
    // vite.config.ts
    import { defineConfig } from 'vite';
    import mockApi from '@ndriadev/vite-plugin-api-rest-fs-mock';
    
    export default defineConfig({
      plugins: [
        mockApi({
          fsDir: 'mock', // Directory relative to your project root
          endpointPrefix: '/api'
        }),
      ],
    });
    ```

2.  **Create your mock file structure:**
    ```
    .
    ├── mock/
    │   └── api/
    │       ├── users/
    │       │   ├── index.json  // Contains: [{ "id": 1, "name": "User 1" }, ...]
    │       │   └── 1.json      // Contains: { "id": 1, "name": "User 1" }
    │       └── products.json
    └── vite.config.ts
    ```

3.  **Make requests:**
    *   `GET /api/users` will serve the contents of `./mock/api/users/index.json`.
    *   `GET /api/users/1` will serve the contents of `./mock/api/users/1.json`.
    *   `POST /api/products` will create or overwrite `./mock/api/products.json` with the request body.
    *   `DELETE /api/users/1` will delete the file `./mock/api/users/1.json`.

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `disable` | `boolean` | `false` | Disables the plugin entirely. |
| `logLevel` | `"info" \| "warn" \| "error" \| "debug" \| "silent"` | `"info"` | Sets the logging level. |
| `delay` | `number` | `0` | Adds a delay (in milliseconds) to every response to simulate network latency. |
| `gatewayTimeout` | `number` | `0` | If set, simulates a gateway timeout by responding with a 504 status after the specified milliseconds. |
| `endpointPrefix` | `string \| string[]` | `"/api"` | A URL prefix or list of prefixes that the plugin will handle. Requests not matching a prefix will be ignored. |
| `fsDir` | `string` | `null` | The root directory for file-system based mocking, relative to the Vite root. |
| `noHandledRequestsAction` | `"404" \| "forward"` | `"404"` | Action for requests that match `endpointPrefix` but are not handled. `"404"` sends a 404 response; `"forward"` passes the request to the next middleware. |
| `parser` | `boolean \| object` | `true` | Configures request parsing. `true` enables default parsing for JSON, form-data, etc. `false` disables it. An object with `parser` and `transform` functions allows for custom parsing logic. |
| `handlerMiddlewares` | `ApiRestFsMockMiddlewareFunction[]` | `[]` | An array of Express-like middleware functions to be executed before request handlers. |
| `errorMiddlewares` | `ApiRestFsMockErrorHandleFunction[]` | `[]` | An array of Express-like error-handling middleware functions. |
| `handlers` | `ApiRestFsMockHandler[]` | `[]` | An array of custom request handlers for more complex logic. See [Custom Handlers](#custom-handlers). |
| `pagination` | `ApiRestFsMockPagination` | `null` | Global configuration for paginating results from JSON array files. See [Pagination and Filtering](#pagination-and-filtering). |
| `filters` | `ApiRestFsMockFilter` | `null` | Global configuration for filtering results from JSON array files. See [Pagination and Filtering](#pagination-and-filtering). |

## Examples

### Custom Handlers

For dynamic responses, define custom handlers. They use Ant-style path matching to capture URL segments.

```typescript
// vite.config.ts
import mockApi from '@ndriadev/vite-plugin-api-rest-fs-mock';

export default {
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      handlers: [
        {
          // Matches /api/users/123, /api/users/abc, etc.
          pattern: '/users/{id}',
          method: 'GET',
          handle: (req, res) => {
            // req.params is automatically populated with URL variables
            const { id } = req.params;
            const user = { id, name: `Dynamic User ${id}`, timestamp: new Date() };

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(user));
          },
        },
        {
          pattern: '/login',
          method: 'POST',
          handle: (req, res) => {
            // req.body is available if parsing is enabled
            const { username, password } = req.body;
            if (username === 'admin' && password === 'password') {
              res.statusCode = 200;
              res.end(JSON.stringify({ token: 'fake-jwt-token' }));
            } else {
              res.statusCode = 401;
              res.end(JSON.stringify({ message: 'Invalid credentials' }));
            }
          }
        }
      ],
    }),
  ],
};
```

### Pagination and Filtering

The plugin provides powerful, built-in pagination and filtering for FS-based responses that return a JSON array.

```typescript
// vite.config.ts
import mockApi from '@ndriadev/vite-plugin-api-rest-fs-mock';

export default {
  plugins: [
    mockApi({
      fsDir: 'mock',
      endpointPrefix: '/api',
      pagination: {
        // Apply this pagination to all GET requests
        GET: {
          type: 'query-param', // Read pagination fields from query params
          limit: 'limit',      // e.g., ?limit=10
          skip: 'skip',        // e.g., ?skip=20
          sort: 'sort',        // e.g., ?sort=name
          order: 'order',      // e.g., ?order=DESC
        },
      },
      filters: {
        GET: {
          type: 'query-param',
          filters: [
            { key: 'name', valueType: 'string', comparison: 'regex' }, // e.g., ?name=^J
            { key: 'isActive', valueType: 'boolean', comparison: 'eq' }, // e.g., ?isActive=true
          ],
        },
      },
    }),
  ],
};
```

Given a file `mock/api/items.json` containing an array of objects, you can now make requests like:
`GET /api/items?limit=5&skip=10&sort=price&order=ASC&name=Widget`

### Middleware

Use middlewares for cross-cutting concerns like logging or authentication.

```typescript
// vite.config.ts
import mockApi from '@ndriadev/vite-plugin-api-rest-fs-mock';

export default {
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      // This middleware will run for every handled request
      handlerMiddlewares: [
        (req, res, next) => {
          console.log(`[Mock API] Received ${req.method} request for ${req.url}`);
          // Example of adding a custom header to the request object
          req.headers['x-request-id'] = 'mock-' + Date.now();
          next(); // Pass control to the next middleware or handler
        }
      ],
      handlers: [
        // ... your handlers
      ]
    }),
  ],
};
```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
