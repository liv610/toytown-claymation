// The Toy Town story (Phase 1, Milestone 1): four chapters and a finale, as data. DRAFT COPY for Toys for Tots to review;
// every operational detail that needs confirming from official sources is listed in `confirm`.
//
// Each beat's `scene` says what to show, not how: { still, alt, focus } is today's scaffolding image, { slate } a scene
// still in development, and later { shot: '<id>' } can name a 3D camera shot. The story interface (story.js) asks a
// registered stage to show it, so replacing a still with a 3D scene changes this file and a stage, never the interface.
// Text, scene descriptions and actions are also what "Read as text" and the non-3D story show: one script, two views.
export const STORY = {
  place: 'Toy Town',
  chapters: [
    {
      id: 'what', title: 'What is Toys for Tots?', next: 'See How It Works',
      beats: [
        { id: 'welcome', scene: { shot: 'arrival', still: 'tt_village.jpg', focus: '35% 55%', alt: 'A snowy felt town at dusk: a toy shop with a striped awning, a lit tree, and a Marine on the street.' },
          lines: ['Welcome to Toy Town.', 'A small town that shows how a big idea works.'] },
        { id: 'community', scene: { shot: 'street', still: 'mh_community.jpg', focus: '50% 55%', alt: 'Neighbors walk along a snowy street toward the community hall, where a volunteer waves.' },
          lines: ['Every holiday season, neighbors, volunteers and Marines come together so more children have a gift to open.'], confirm: ['Mission wording'] },
        { id: 'follow', scene: { shot: 'box', still: 'tt_window.jpg', focus: '40% 55%', alt: 'A toy shop window full of felt toys: a teddy bear, a rocking horse and a little red truck.' },
          lines: ['Toys for Tots helps communities give toys to children whose families need support.', 'Let’s follow one toy, a little red truck, and see how it works.'], confirm: ['Mission wording'] },
      ],
    },
    {
      id: 'how', title: 'How does it work?', next: 'How Can I Take Part?',
      beats: [
        { id: 'collect', eyebrow: 'Collection · October to December', scene: { still: 'mh_box.jpg', focus: '50% 60%', alt: 'At the town’s red collection box, the little red truck goes in, new and unwrapped.' },
          lines: ['In the holiday season, people drop new, unwrapped toys and books into collection boxes around town.'], confirm: ['Collection months', 'New and unwrapped', 'Books accepted'] },
        { id: 'pickup', eyebrow: 'Collection', scene: { still: 'tt_story2.jpg', focus: '45% 60%', alt: 'A Marine lifts the donated toys out of the red box beside the toy shop.' },
          lines: ['Marines and volunteers collect the donations from the boxes.'], confirm: ['Who collects'] },
        { id: 'sort', eyebrow: 'Sorting · usually December', scene: { slate: 'The sorting hall', alt: 'Scene in development: volunteers and Marines sort toys on long tables into boxes by age.' },
          lines: ['The toys are gathered, sorted and prepared for children of different ages.', 'Each local campaign organizes this in its own way.'], confirm: ['Sorting month', 'Sorting by age', 'Roles of Marines and volunteers'] },
        { id: 'share', eyebrow: 'Distribution · mid to late December', scene: { slate: 'Gifts reach families', alt: 'Scene in development: a parent leaves a community building with a bag of gifts; a window lights up at home.' },
          lines: ['Local campaigns and partner organizations get the gifts to families who need them.', 'How gifts are shared depends on the community.'], confirm: ['Distribution timing', 'Role of partner organizations'] },
      ],
    },
    {
      id: 'request', title: 'How do I request toys?', next: 'Continue: How to Help',
      beats: [
        { id: 'help', scene: { slate: 'Asking for help', alt: 'Scene in development: a parent at home looks up their local campaign on a laptop.' },
          lines: ['If your family needs help this holiday season, your local Toys for Tots campaign may be able to help.'], confirm: ['Who can request'] },
        { id: 'steps', scene: { slate: 'Four steps', alt: 'Scene in development: the four steps shown as signs along a Toy Town street.' },
          lines: ['Here’s how it usually works:'],
          list: [
            { title: 'Find your local campaign', text: 'Search your ZIP code to find the campaign that serves your area.' },
            { title: 'Read its instructions', text: 'Check who it serves, what to have ready, and its deadlines.' },
            { title: 'Apply through the campaign', text: 'Follow its own application process on its website.' },
            { title: 'Hear about next steps', text: 'If your request is approved, the campaign tells you how and when gifts are shared.' },
          ],
          note: 'Each campaign sets its own process and dates. Requests aren’t made on this site.',
          actions: ['finder'], confirm: ['Application process', 'Eligibility and deadlines', 'Wording that approval is not guaranteed'] },
      ],
    },
    {
      id: 'help', title: 'How can I help?', next: 'Finish the Story',
      beats: [
        { id: 'neighbor', scene: { still: 'tt_story1.jpg', focus: '45% 55%', alt: 'Back on the main street, a Marine walks past the red collection box outside the toy shop.' },
          lines: ['The little red truck’s journey started with one neighbor.', 'Yours can start too.'] },
        { id: 'ways', scene: { still: 'tt_village.jpg', focus: '55% 55%', alt: 'Toy Town’s main street at dusk, with the toy shop, the tree and the collection box.' },
          lines: ['Three ways to take part:'],
          list: [
            { title: 'Give a toy', text: 'Bring a new, unwrapped toy to a collection location during the season. Your local campaign lists where.' },
            { title: 'Give money', text: 'Make a donation through the Marine Toys for Tots Foundation.' },
            { title: 'Volunteer', text: 'Many local campaigns welcome volunteers. Ask yours.' },
          ],
          actions: ['finder', 'donate'], confirm: ['Collection locations', 'Official donation destination', 'Volunteer opportunities'] },
      ],
    },
  ],
  finale: {
    id: 'finale', title: 'Your community',
    beats: [
      { id: 'yours', scene: { shot: 'country', still: 'country.jpg', focus: '55% 45%', alt: 'The felt map of the whole country, with three railroad lines meeting at Toy Town.' },
        lines: ['Every community has a part to play. Find yours.'], actions: ['finder', 'donate'] },
    ],
  },
};
