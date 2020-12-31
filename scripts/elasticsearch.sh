#!/bin/bash

exec docker run \
  --rm \
  --env "discovery.type=single-node" \
  --env "cluster.routing.allocation.disk.threshold_enabled=false" \
  --env "bootstrap.memory_lock=true" \
  --env "ES_JAVA_OPTS=-Xms1g -Xmx1g" \
  --env "ELASTIC_PASSWORD=changeme" \
  --env "xpack.security.enabled=true" \
  --env "xpack.security.authc.api_key.enabled=true" \
  --env "xpack.license.self_generated.type=basic" \
  --ulimit nofile=65536:65536 \
  --ulimit memlock=-1:-1 \
  --publish 9200:9200 \
  docker.elastic.co/elasticsearch/elasticsearch:8.0.0-SNAPSHOT
