#!/bin/bash

PORT=3000
APP="server.js"

get_pid() {
  lsof -ti :$PORT 2>/dev/null
}

case "$1" in
  start)
    pid=$(get_pid)
    if [ -n "$pid" ]; then
      echo "Already running on port $PORT (PID $pid)"
      exit 1
    fi
    node "$APP" &
    sleep 1
    pid=$(get_pid)
    if [ -n "$pid" ]; then
      echo "Started on port $PORT (PID $pid)"
    else
      echo "Failed to start"
      exit 1
    fi
    ;;
  stop)
    pid=$(get_pid)
    if [ -z "$pid" ]; then
      echo "Not running"
      exit 0
    fi
    kill $pid
    echo "Stopped (PID $pid)"
    ;;
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
  status)
    pid=$(get_pid)
    if [ -n "$pid" ]; then
      echo "Running on port $PORT (PID $pid)"
    else
      echo "Not running"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
