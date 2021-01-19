# Deploy on Google Cloud Run

Unlike AWS Lambda or Google Cloud Functions, Google Cloud Run is a serverless **container** environment. It's primary purpose is to provide an infrastructure-abstracted environment to run arbitrary containers. As a result, Fastify can be deployed to Google Cloud Run with little-to-no code changes from the way you would write your Fastify app normally.

*Follow the steps below to deploy to Google Cloud Run if you are already familiar with gcloud or just follow their [quickstart](https://cloud.google.com/run/docs/quickstarts/build-and-deploy)*.
You can also take a look at the [unofficial Cloud Run FAQ](https://github.com/ahmetb/cloud-run-faq).

## Additional files

To make your Fastify application work with Cloud Run you need some additional files that you can find in this folder.

- `Dockerfile` - The image definition of your application, if you don't have native dependencies, it should work as is.
- `index.js` - Your application entry point, it already format the logs in a Stackdriver coompatible format
- `deploy-action.yml` - A GitHub action to deploy your application to Cloud Run (the environment variables needs to be stored in [GitHub secrets](https://docs.github.com/en/free-pro-team@latest/actions/reference/encrypted-secrets)).
- `.dockerignore`
- `.gcloudignore`

## Submit build

Submit your app to be built into a Docker image by running the following command (replacing `PROJECT-ID` and `APP-NAME` with your GCP project id and an app name):

```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/APP-NAME
```

## Deploy Image

After your image has built, you can deploy it with the following command:

```bash
gcloud run deploy --image gcr.io/PROJECT-ID/APP-NAME --platform managed --allow-unauthenticated
```

Your app will be accessible from the URL GCP provides.