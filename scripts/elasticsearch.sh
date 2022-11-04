#!/bin/bash

# Create the 'elastic' network if doesn't exist
exec docker network ls | grep elastic > /dev/null || docker network create elastic > /dev/null

docker run \
  --rm \
  --env "node.name=es1" \
  --env "ELASTIC_PASSWORD=changeme" \
  --env "cluster.name=docker-elasticsearch" \
  --env "cluster.initial_master_nodes=es1" \
  --env "discovery.seed_hosts=es1" \
  --env "cluster.routing.allocation.disk.threshold_enabled=false" \
  --env "bootstrap.memory_lock=true" \
  --env "ES_JAVA_OPTS=-Xms1g -Xmx1g" \
  --env "xpack.license.self_generated.type=basic" \
  --env "http.port=9200" \
  --env "action.destructive_requires_name=false" \
  --ulimit nofile=65536:65536 \
  --ulimit memlock=-1:-1 \
  --publish "9200:9200" \
  --network=elastic \
  --name="es1" \
  docker.elastic.co/elasticsearch/elasticsearch:8.5.0
