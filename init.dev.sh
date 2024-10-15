#! /bin/bash

# This file is owned by carmendata/swarm, any changes to be made to this file
# should be made in that repo otherwise they will be overwritten.

# This script is used to start the development service containers
# and setup a sandboxed development environment.

# Initialise our git hooks
git config --local core.hooksPath .githooks/

# Remove NODE_ENV from the .bashrc file
sed -i '/NODE_ENV/d' ~/.bashrc
# Set the environment variables & persist them
echo "export NODE_ENV=development" >>~/.bashrc
# Reload the .bashrc file, so that the environment variable is set,
# root uses the bourne shell, so we need to use the following command
. ~/.bashrc
# source ~/.bashrc

# Setup pnpm
SHELL=bash pnpm setup
. ~/.bashrc
# Update pnpm
pnpm add -g pnpm
# Update npm
npm install -g npm@latest
# Install the dependencies
pnpm install

# Start the development services, if we have a docker-compose.dev.yml file
if [ -f "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml up -d
fi

# Run the installation script if it exists
if [ -f "install.sh" ]; then
    ./install.sh
    if [ $? -ne 0 ]; then
        exit 1
    fi
fi

# Synchronise common files
if [ -f ".dev/sync.mjs" ]; then
    node .dev/sync.mjs
fi

# Run the tests if there is a "test" script in the package.json file
if [ -f "package.json" ]; then
    if grep -q '"test":' package.json; then
        pnpm test
    fi
fi
