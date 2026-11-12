export const APPROVAL_COMMENT_MAX_LENGTH = 1000;

export const assertApprovalCommentLength = (comments) => {
  const value = String(comments || '');
  if (value.length > APPROVAL_COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be ${APPROVAL_COMMENT_MAX_LENGTH} characters or fewer.`);
  }
  return value.trim();
};
