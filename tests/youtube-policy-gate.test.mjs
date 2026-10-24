import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateChildrenFactoryPreflight,
  evaluateContentOriginality,
  evaluateYouTubePublishGate,
  requiredYouTubePolicyAttestations,
} from '../server/youtube-policy-gate.mjs';

const safeStory = [
  'Milo the little fox planted a seed beside the school garden.',
  'Each morning, Milo watered it and watched for a new leaf.',
  'His friend Nia wanted to help, so they made a gentle watering plan.',
  'When the sun felt warm, they took a break in the shade.',
  'After several days, a small green sprout appeared.',
  'Milo wanted to keep it all for himself, but Nia reminded him that sharing made the garden better.',
  'They invited other friends to care for the plants.',
  'Every child chose a small task, and everyone took turns.',
  'The garden grew with flowers, herbs, and cheerful colors.',
  'Milo learned that patience, teamwork, and kindness can help little things grow.',
].join(' ');

const character = {
  name: 'Milo',
  species: 'fox',
  color: 'orange',
  clothes: 'blue scarf',
  description: 'A curious, kind young fox',
};

const policyReview = Object.fromEntries(
  requiredYouTubePolicyAttestations().map(({ key }) => [key, true]),
);

test('clean child-safe story passes the basic automated preflight', () => {
  const result = evaluateChildrenFactoryPreflight({
    topic: 'friendship and gardening',
    title: 'Milo and the Little Garden',
    story: safeStory,
    character,
    age: 5,
  });
  assert.equal(result.status, 'preflight_passed');
  assert.deepEqual(result.blockingFindings, []);
});

test('dangerous challenge language blocks Children Factory preflight', () => {
  const result = evaluateChildrenFactoryPreflight({
    title: 'A garden story',
    story: safeStory + ' Never try this at home; play with fire.',
    character,
    age: 5,
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockingFindings.some(item => item.code === 'CHILD_DANGEROUS_CHALLENGE'));
});

test('known third-party character references require review rather than silently passing', () => {
  const result = evaluateChildrenFactoryPreflight({
    title: 'A cartoon adventure',
    story: safeStory + ' Peppa Pig visits the garden.',
    character,
    age: 5,
  });
  assert.equal(result.status, 'review_required');
  assert.ok(result.reviewFindings.some(item => item.code === 'POSSIBLE_THIRD_PARTY_IP'));
});

test('Children Factory publishing requires all review attestations and explicit disclosure choices', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Milo and the Little Garden',
    description: 'An original story about sharing and patience.',
    isChildrenFactory: true,
    story: safeStory,
    topic: 'friendship and gardening',
    character,
    age: 5,
    madeForKids: true,
    containsSyntheticMedia: false,
    policyReview,
  });
  assert.equal(result.ready, true);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.missingAttestations, []);
});

test('Children Factory upload cannot go directly public before Studio review', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Milo and the Little Garden',
    isChildrenFactory: true,
    story: safeStory,
    topic: 'friendship and gardening',
    character,
    age: 5,
    madeForKids: true,
    containsSyntheticMedia: false,
    privacyStatus: 'public',
    policyReview,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockingFindings.some(item => item.code === 'CHILDREN_FACTORY_PRIVATE_FIRST_REQUIRED'));
});

test('Children Factory upload is blocked if audience is not Made for Kids', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Milo and the Little Garden',
    isChildrenFactory: true,
    story: safeStory,
    character,
    age: 5,
    madeForKids: false,
    containsSyntheticMedia: false,
    policyReview,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockingFindings.some(item => item.code === 'CHILDREN_FACTORY_MUST_BE_MADE_FOR_KIDS'));
});

test('missing synthetic-media choice blocks an upload', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Milo and the Little Garden',
    isChildrenFactory: true,
    story: safeStory,
    character,
    age: 5,
    madeForKids: true,
    policyReview,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockingFindings.some(item => item.code === 'YOUTUBE_AI_DISCLOSURE_SELECTION_REQUIRED'));
});

test('incomplete human rights and originality review blocks upload', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Milo and the Little Garden',
    isChildrenFactory: true,
    story: safeStory,
    character,
    age: 5,
    madeForKids: true,
    containsSyntheticMedia: false,
    policyReview: {},
  });
  assert.equal(result.ready, false);
  assert.equal(result.missingAttestations.length, 6);
});

test('deceptive engagement wording in metadata blocks upload', () => {
  const result = evaluateYouTubePublishGate({
    title: 'Buy views and subscribers now',
    madeForKids: true,
    containsSyntheticMedia: false,
    policyReview,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockingFindings.some(item => item.code === 'ENGAGEMENT_MANIPULATION'));
});

test('title length and description byte limits are enforced', () => {
  const titleResult = evaluateYouTubePublishGate({
    title: 'T'.repeat(101),
    madeForKids: true,
    containsSyntheticMedia: false,
    policyReview,
  });
  assert.ok(titleResult.blockingFindings.some(item => item.code === 'YOUTUBE_TITLE_TOO_LONG'));

  const descriptionResult = evaluateYouTubePublishGate({
    title: 'Safe title',
    description: 'a'.repeat(5001),
    madeForKids: true,
    containsSyntheticMedia: false,
    policyReview,
  });
  assert.ok(descriptionResult.blockingFindings.some(item => item.code === 'YOUTUBE_DESCRIPTION_TOO_LONG'));
});

test('recent exact-title and near-duplicate story are blocked', () => {
  const existingProjects = [{
    id: 'project-1',
    title: 'Milo and the Little Garden',
    story_bible: {
      factory: 'children-v1',
      story: safeStory,
    },
  }];
  const sameTitle = evaluateContentOriginality({
    title: 'Milo and the Little Garden',
    story: 'A completely different story about a balloon.',
    existingProjects,
  });
  assert.equal(sameTitle.status, 'blocked_near_duplicate');

  const sameStory = evaluateContentOriginality({
    title: 'A New Title',
    story: safeStory,
    existingProjects,
  });
  assert.equal(sameStory.status, 'blocked_near_duplicate');
});

test('distinct story and title can pass the recent-project originality screen', () => {
  const existingProjects = [{
    id: 'project-1',
    title: 'Milo and the Little Garden',
    story_bible: {
      factory: 'children-v1',
      story: safeStory,
    },
  }];
  const result = evaluateContentOriginality({
    title: 'Nia Builds a Paper Rocket',
    story: 'Nia folded colorful paper into a little rocket. Her friends helped her test how different shapes floated through the air. They drew designs, measured distances, and learned that careful experiments can be fun. At the end, they recycled the paper and wrote down what they discovered.',
    existingProjects,
  });
  assert.equal(result.status, 'unique_in_recent_projects');
});
