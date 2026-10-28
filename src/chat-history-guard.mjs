export function shouldApplyCloudHistory(requestInteractionVersion, currentInteractionVersion, cloudMessages) {
  return requestInteractionVersion === currentInteractionVersion
    && Array.isArray(cloudMessages)
    && cloudMessages.length > 0;
}
