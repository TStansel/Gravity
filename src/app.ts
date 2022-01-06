

interface Triggerable {
  trigger(): void;
}

class TriggerStepFunction implements Triggerable {
  trigger() {
    console.log("triggered");
  }
}

function execute(triggerable: Triggerable) {
  triggerable.trigger();
}

const triggerStepFunction = new TriggerStepFunction();

execute(triggerStepFunction);