import os
from redis import Redis
from rq import Worker

redis_host = os.getenv('REDIS_HOST', 'redis')

redis_conn = Redis(host=redis_host, port=6379)

if __name__ == "__main__":
    os.makedirs("sessions", exist_ok=True)

    worker = Worker(['default'], connection=redis_conn)
    print('Linux Sandbox Worker is listening for tasks on {redis_host}...')
    worker.work()