<p align="center">
<picture>
    <source srcset="https://github.com/subsquid-quests/network-test-one-uniform-load-squid/assets/7452464/135746dc-a48b-46b8-bce0-f7e5de18f4f9" media="(prefers-color-scheme: dark)">
    <img src="https://github.com/subsquid-quests/network-test-one-uniform-load-squid/assets/7452464/135746dc-a48b-46b8-bce0-f7e5de18f4f9" alt="Subsquid Logo">
</picture>
</p>

# Algebra Migration Squid

Algebra Migration is an implementation of the Algebra Subgraph using the [Squid SDK](https://docs.subsquid.io/), migrating the Algebra subgraph to the squid SDK. It provides a powerful and flexible way to interact with on-chain data and query information from both EVM and WASM blockchains.

## Prerequisites

Before getting started, ensure you have the following dependencies installed on your machine:

- [Node.js](https://nodejs.org/): JavaScript runtime for running JavaScript applications.
- [Docker](https://www.docker.com/): Used to manage containers for PostgreSQL.

## Quickstart

Follow these steps to set up and run farcaster migration on your local machine:

```bash
# 0. Install @subsquid/cli globally (the sqd command)
npm i -g @subsquid/cli

# 1. Clone the repository
git clone https://github.com/RicqCodes/Algebra_Subgraph_MIgration

# 2. Navigate to the project folder
cd Algebra_Subgraph_MIgration

# 3. Rename .env.example to .env and configure environment variables

# 4. Install project dependencies
npm i

# 5. Build the project
sqd build

# 6. Start a PostgreSQL database container and detach
sqd up

# 7. Run migrations
sqd migration:generate
sqd migration:run

# 8. Start the processor
sqd process

# 9. The processor command will block the terminal while fetching chain data,
#    transforming it, and storing it in the target database.
#    To start the GraphQL server, open a separate terminal and run
sqd serve
```

A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

## Query Examples
