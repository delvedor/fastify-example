# scurte

Scurte is a small but feature complete application build with Fastify and Svelte,
and it aims to show all the core concepts of Fastify, best  practices, and recommendations.

## Project structure

### How should I read through the comments?

You you can read the project in any order, but I would recommend the following:

1. `plugins/authorization/index.js`
1. `plugins/elasticsearch.js`
1. `plugins/rate-limit.js`
1. `plugins/validUrl.js`
1. `routes/status.js`
1. `routes/frontend.js`
1. `routes/admin.js`
1. `routes/redirect/index.js`
1. `routes/redirect/worker.cjs`
1. `routes/redirect/App.svelte`
1. `ui/*`
1. `test/helper.js`
1. `test/plugins/*`
1. `test/routes/*`

## How to run this project

1. Create an `.env` file from the template:

    ```sh
    cp .env.template .env
    ```

2. Create a new GitHub OAuth application [here](https://github.com/settings/applications/new), then copy the app id and secret and add them to the env file:

    ```dosini
    GITHUB_APP_ID=<app-id>
    GITHUB_APP_SECRET=<app-secret>
    ```

3. Add your primary GitHub email to the `ALLOWED_USERS` variable:

    ```dosini
    ALLOWED_USERS=<your-primary-github-mail>
    ```

4. Run the `keys-generator` script and store the result in the `COOKIE_SECRET` env variable:

    ```sh
    node scripts/keys-generator.js
    ```

    ```dosini
    COOKIE_SECRET=<generated-key>
    ```

Now you can either run the project locally or deploy it.

### Locally

1. Install the project dependencies:

    ```sh
    npm install
    ```

2. In a separate terminal window, run Elasticsearch:

    ```sh
    npm run elasticsearch
    ```

3. Once Elasticsearch is up and running, run the `prepare-elasticsearch` script and copy the result in the `ELASTIC_URL` and `ELASTIC_API_KEY` env variables:

    ```js
    node scripts/prepare-elasticsearch.js
    ```

    ```dosini
    ELASTIC_URL=<result.address>
    ELASTIC_API_KEY=<result.apiKey>
    ```

4. You are all set! Run the project with thw following command:

    ```sh
    npm run dev
    ```

### Deploy

[TODO]

#### Vercel

[TODO]

#### Cloud  Run

[TODO]

#### Elastic Cloud

[TODO]

## Contribute

[TODO]

## License

This software is licensed under the [Apache 2 license](./LICENSE).
