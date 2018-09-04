# 1 worker

first worker won't get its own preparedBytedEnd defined. I need different logic for 1-worker job.

- It should just gather the whole file for itself
- It shouldn't run seek header and prepare anything.

