module.exports = logs =>
    logs.filter(
      log =>
        !log.event.startsWith("__") &&
        log.event !== "NewOwner",
    );
