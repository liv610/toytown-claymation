# Testing guide: does exploring or storytelling add anything?

This guide is for observing a handful of people (5–8 is plenty for a first round) using the journey prototype.

The question: does entering Toy Town (exploration) or following the Marine (storytelling) add something
meaningful beyond a direct "Find a toy drop-off" button? It might add understanding, motivation or follow-through.
It might also add friction.

## 1. Before the first session

**Devices.** Use the device people would really use. At least two sessions should be on a phone.
- On a laptop, use Chrome or Safari, full screen.
- Open the prototype once on each device to check it runs smoothly. The test log shows the fps (`perf`) after arriving
  in Toy Town. If it is under 20, test that device with `#simple` or `#direct` only.

**Links.** Add a condition to the end of the prototype's address:

| Condition | Add to the address | Who sees it |
|---|---|---|
| Direct | `#direct` | 2 people |
| Exploration | `#explore` | 2 people |
| Storytelling | `#story` | 2 people |

**Rotate the order.** For example: P1 story, P2 direct, P3 explore, P4 direct, P5 explore, P6 story. That way, time of day
and your own practice don't favour one condition.

**Reset.** Clear old data in the test log (**Clear all…**, click twice) before a test day.

## 2. Setting up each session (about 30 seconds)

1. Open the prototype with the participant's condition.
2. Click **Test log** (bottom right; at the top right on phones) and type the participant label (P1, P2…).
3. Close the panel, then reload the page so the session starts clean.
4. Hand over the device.

For the next person, use **Start next participant** in the panel. It increments the label and reloads.

## 3. The script

Read it as written. Don't mention "drop-off", "Toy Town", "Marine" or "explore".

> "Thanks for helping. This is an early concept, so nothing here is real: no payments, no real locations, and you
> can't break anything. I'm testing the design, not you. Please think out loud as you go: what you notice, what you
> expect, what's confusing."

**Task A (open):**

> "Imagine it's November. You saw a post about this site and you'd like to help a child have a better holiday.
> Show me what you would do here."

Let them go for up to 4 minutes. Don't help. If they're stuck for over a minute, say "What would you try next?"

**Task B (only if they didn't reach the drop-off search in Task A):**

> "Say you've bought a new toy and want to donate it. Find somewhere you could drop it off."

**Task D (online gifting; a separate round, or after Task A):**

> "Say you'd like to give a toy to a child somewhere else in the country, without leaving home. Show me how you'd do it here."

Watch for:
- Do they find "Send a toy online" or step into the toy shop?
- Do they play with the toys?
- Do they understand that the toy goes to a local campaign, not to a named child?
- Do they watch the departure or skip it?

Afterwards, ask: "Where do you think your toy went?"

**Task C (optional; a different person, or at the end):**

> "Now imagine your own family needs help getting toys this year. What would you do?"

This checks that families are never routed through the world. Note the time to the "Request toys" screen.

## 4. What to watch for

Note these by hand; the log covers clicks and timings.

| Moment | What to note |
|---|---|
| First 10 seconds | What they look at first. Do they read the question? Do they notice the action bar? |
| Landing | Do they go straight to an action, or choose "Enter Toy Town"? What do they say about it? |
| Descent | Do they wait patiently, skip, or seem impatient? |
| In Toy Town | Do they understand what's clickable? Do they drag to look around? Any delight ("oh!")? |
| Toy shop card | Do they read it? Do they click through, or keep exploring? |
| The Marine's moment | Do they watch it all or skip? Do they react to the lift-and-look or the wagon? Do they read the captions? |
| Drop-off search | Any hesitation over the ZIP field? Do they notice the placeholder label? |
| Throughout | Any moment where the world got in the way of what they wanted to do. |

## 5. Questions afterwards (about 3 minutes)

1. "In your own words, what is this organisation about?"
2. "What do you think happens to a toy after someone drops it off?" (This is the comprehension check: does the story
   teach "it stays in the community"?)
3. "How likely would you be to actually drop off a toy after this?" (1–5)
4. "Was there anything that slowed you down or felt like it was in the way?"
5. Exploration and story conditions only: "Was the little village worth the time, or would you rather have just seen the
   buttons?"

Optionally, show them one of the other conditions for 30 seconds and ask which they'd prefer and why.

## 6. Reading the results

After the sessions, open the test log and click **Copy CSV**. If copying is blocked, the data is selected for you to
copy. Each row is one session.

Key columns:

| Column | Meaning |
|---|---|
| `path` | Which path led to the drop-off search: direct, explore or story |
| `timeToDropoffS` | Seconds from landing to opening the drop-off search |
| `chosen` | Whether they picked a drop-off location (the conversion) |
| `stoppedAt` | The furthest step reached |
| `storyFinished`, `storySkipped`, `storyWatchedS` | How the story went |
| `hotspots` | What they explored |
| `otherActions` | Other actions they tried |
| `giftPath`, `giftOrdered`, `toysViewed`, `departureWatched` | The online-gift journey (Task D) |

With a handful of people this is qualitative. Look for patterns, not percentages.

**Exploration or story helps if:**
- people in those conditions explain the mission better (question 2);
- they rate their intent higher (question 3);
- they reach "chose a drop-off" at least as often as direct, and say the village made them want to help.

**It hurts if:**
- time to the action is much longer without better understanding;
- people skip the story or say they "just wanted the button";
- anyone in Task C hesitates because of the world.

**It's neutral if:** outcomes match direct but people enjoyed it. That points to the world's value being in marketing
and sharing rather than conversion. That is still useful to know.

**Before trusting differences**, check `stoppedAt` for drop-offs at the same step across several people. That's a
usability problem to fix before the next round.

## 7. Limits to keep in mind

- **Placeholder data:** everything is placeholder, so "chose a drop-off" means intent inside a prototype, not a real
  donation.
- **A test room isn't the real world:** participants are in a test situation and will explore more than real visitors.
  A later live A/B test (traditional page vs. the world) is the real measure.
- **Draft copy:** the story copy is a draft and hasn't been reviewed by the organisation.
