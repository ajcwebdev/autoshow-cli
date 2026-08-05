---
title: "2023-04-05-jsjam-react-miami-2023-10-minutes"
slug: "2023-04-05-jsjam-react-miami-2023-10-minutes"
duration: "Unknown"
channel: "Unknown"
url: "https://ajc.pics/autoshow/benchmarks/stt/2023-04-05-jsjam-react-miami-2023-10-minutes.mp3"
---

This is a transcript with timestamps. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.

- Write a one-sentence description of the transcript.
  - The one-sentence description shouldn't exceed 180 characters (roughly 30 words).

- Write a one-paragraph summary.
  - The one-paragraph summary should be approximately 600-1200 characters (roughly 100-200 words).

- Create chapter titles and descriptions based on the topics discussed throughout.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should each cover approximately 3-6 minutes of content.
  - Write a two-paragraph description (75+ words) for each chapter.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content, avoiding formulaic language.

Example JSON output:

{
  "shortSummary": {
    "episodeDescription": "A concise one-sentence description of the transcript in 180 characters or fewer."
  },
  "longSummary": {
    "episodeSummary": "A single-paragraph summary of the transcript that explains the central topic, the main arguments or developments, the evidence or examples used to support them, and the broader takeaway for the audience. It should read as one cohesive paragraph rather than a list, staying informative without becoming exhaustive. The summary should mention the most important themes, clarify what changed or was learned over the course of the discussion, and note any conclusions, recommendations, or implications that would help someone understand the full conversation without reading the entire transcript. It should also preserve the flow of the discussion so the reader can follow how the ideas developed from beginning to end."
  },
  "longChapters": {
    "chapters": [
      {
        "timestamp": "00:00:00",
        "title": "Introduction and Overview",
        "description": "Introduces the episode's central themes, outlines the main questions guiding the discussion, and explains why the topic matters in practical terms. The chapter gives the audience enough context to follow the conversation, surfaces the core tension or opportunity, and establishes the language that will be revisited in later sections.\n\nIt also signals how the discussion will unfold, connecting the opening ideas to the examples, methods, or case studies that follow. By the end of the chapter, the listener understands the scope of the conversation and the stakes behind the next set of arguments."
      },
      {
        "timestamp": "00:04:30",
        "title": "Core Ideas and Implications",
        "description": "Introduces the episode's central themes, outlines the main questions guiding the discussion, and explains why the topic matters in practical terms. The chapter gives the audience enough context to follow the conversation, surfaces the core tension or opportunity, and establishes the language that will be revisited in later sections.\n\nIt also signals how the discussion will unfold, connecting the opening ideas to the examples, methods, or case studies that follow. By the end of the chapter, the listener understands the scope of the conversation and the stakes behind the next set of arguments."
      }
    ]
  }
}

Transcript:
[00:00:01] [1] Alright, sorry about the Twitter space kerfuffle. Scott got the thing working though.
[00:00:08] [1] Well done, Scott. I know exactly what was happening has happened to me before: sometimes when you start a space, it will show as "starting" on your phone while having not actually been started, where other people can se
[00:00:21] [1] e it and join it. But if you wait, like, 1 to 2 minutes, somehow it just works it out and then all of a sudden goes live.
[00:00:30] [1] So patience is a virtue in that respect. So, for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process.
[00:00:42] [2] Yeah, thank you. Uh, to the audience for rejoining back, and for Scott for soldiering on, and Anthony for the lesson.
[00:00:52] [2] I'm reminded of that, like, old Demotivators poster, which was like the Titanic, and it was like, "Maybe your role is to be a lesson for others.
[00:01:00] [2] " But welcome back, everyone. Do we know if Scott's going to join in separately, Anthony?
[00:01:09] [3] Let's go ahead and just start announcing things. Introducing ourselves, we'll let him work out what he's going to do.
[00:01:15] [2] Okay, great. So, hi everyone, welcome again to JavaScript Jam Live. JavaScript Jam Live is an open mic, we like to say, for anything JavaScript and web development related.
[00:01:29] [2] It's on topic. We love audience participation. We've got something very special for you this week and in the upcoming weeks in collaboration with React Miami.
[00:01:39] [2] I am Isha Anand, I'm VP of Product at Edgeo, Edge Deployment Platform, and I'm joined by
[00:01:47] [2] Anthony and Scott. I'll let them introduce themselves and talk about what we're doing with React Miami.
[00:01:54] [1] Hello, my name is Anthony Campolo. I am a Developer Advocate at Edgeo, and we're going to be joined today by Dev Agrawal, who is also partnering with React Miami to help put together some sweet events and activities and
[00:02:10] [1] content for you. And we are bringing him up right now. And then, Scott, if you are able to speak, go ahead and introduce yourself.
[00:02:19] [1] We also have Shelby.
[00:02:20] [4] Yo, what up, everybody? So hopefully you can hear me.
[00:02:27] [2] Yes.
[00:02:29] [4] Alright, great. Wow. Boy, that was fun earlier. I tell you what, you know, it doesn't matter if you know quite a bit about tech or not, there's always something to make you look like a fool.
[00:02:38] [4] So here we are. Everything's good. Everything's working now. So anyway, so great.
[00:02:44] [4] So glad to be here. React Miami, I don't know why I said week there, but you know, in a hustle to get this up, that's what I put.
[00:02:52] [4] But really, it's React Miami Month, which I'm renaming right now. And I'm super excited because, you know, as Anthony was hinting at there, we're going to be talking with Dev today and about React Miami and many other th
[00:03:06] [4] ings. And also, you know, we're doing our little collab with React Miami as well, and we're just so excited for that.
[00:03:16] [4] Moving forward, we're going to be having more speakers from React Miami speaking here about just topics that make sense for them.
[00:03:23] [4] And you know, we're keeping this traditional, like, JavaScript Jam vibe that we have rolling through all that process.
[00:03:29] [4] So nothing's going to change as far as, like, what you guys typically are used to hearing.
[00:03:34] [4] And you know, as far as, like, having speakers here and all that, it's going to be a great time.
[00:03:37] [4] So really, there's just more value, actually, from us being involved with React Miami, more value for you guys, and some extra goodies that we're going to talk about here a little bit later.
[00:03:48] [4] We're really excited for. So thank you so much. So glad to be here. Just remember, if you're a beginner or an advanced user, whether you've been doing this a little bit or doing this for a very long time as far as a web
[00:04:00] [4] developer goes, we want to hear from everybody. It doesn't matter whether you're a beginner or advanced, like I said.
[00:04:06] [4] And so, you know, don't be afraid to request to come up and ask questions or comments or, like, facts, opinions, whatever it is.
[00:04:15] [4] We want to hear from you. In fact, actually, that also helps to increase the value here for everybody listening in, because when you guys get involved, typically there's some really great conversations that happen.
[00:04:25] [4] So we'd love to hear from as many people as possibly want to come up. So, alright, with that being said, I am Scott Steinlongie, and I am a Technical Community Manager at Edgeo, and I'm ready to rock this today.
[00:04:40] [4] Let's get this rolling. Thank you so much. Appreciate y'all.
[00:04:46] [1] Awesome. We should have Dev introduce himself, and then after that, Michelle, you can introduce yourself.
[00:04:52] [1] And you are one of the organizers of React Miami, so thank you for joining us.
[00:04:59] [5] How's it going, everybody? Thank you very much for having me up here. Thank everyone for showing up and showing interest.
[00:05:06] [5] My name is Dev, or you can call me Dave. Both work fine. And yeah, it's great to be here.
[00:05:13] [5] This year I am also a media partner for React Miami, along with these two great individuals, Anthony and Scott.
[00:05:21] [5] And yeah, I'm very excited to show you guys what we have in store for next week, or talk about it a little today.
[00:05:34] [5] Michelle, you want to go?
[00:05:41] [1] If you're not currently at your mic or something, Dan, it looks like you hopped up as well.
[00:05:46] [1] I don't think Dan's going to be at React Miami.
[00:05:48] [2] I wish. I'm having a company offsite for that week, otherwise I would have gone.
[00:05:54] [2] But yeah, I don't think I deserve to introduce myself because I'm not a media partner at React Miami.
[00:06:02] [1] Okay, well, cool. It looks like Will showed up anyway. That's so funny.
[00:06:11] [1] Cool. So I guess we can let Dev. Do you want to kind of talk about your game show idea?
[00:06:17] [1] I thought this was pretty interesting.
[00:06:21] [5] Sure, yeah. So I have mandates to robe these two people into hosting a game show with me.
[00:06:27] [5] This is happening next week. We are calling it Miami Jam, and I'm very excited for this.
[00:06:34] [5] But it looks like Michelle is back up here as a speaker, so
[00:06:39] [5] I think we would like to hear from her first.
[00:06:42] [6] Hi. Sorry, guys, the connection was, like, on the fritz, and then the microphone button wasn't working in the Twitter space, so now it seems like everything's working.
[00:06:52] [4] Oh, we understand.
[00:06:54] [6] But yeah, so.
[00:06:56] [5] That's the normal experience of using Twitter spaces every day.
[00:07:02] [6] Miami, and I'm just kind of crashing the party today, but I'm super excited to have Dev and
[00:07:10] [6] Anthony and Scott all as media partners for React Miami this year. And I'm also listening in, just interested to see what we're going to do, because we kind of, like, just give them the green light to do whatever they lik
[00:07:24] [6] e, s
[00:07:27] [6] o.
[00:07:28] [1] Yeah, we'll see whether you end up regretting it or not. But I think that will have some cool stuff in store.
[00:07:35] [1] So you can probably get back to your description, Dev.
[00:07:41] [5] Sure, yeah. So the idea of Miami Jam is to kind of stray away from, like, a typical interview or panel-style show where we just bring on a few speakers and ask them questions.
[00:07:55] [5] Instead,
[00:07:57] [5] this show, Miami Jam, which we are hosting, is going to be a little more like a game show, where instead of just straight-up asking questions about their topics or their motivations, we are going to ask trivia-style ques
[00:08:11] [5] tions. These can be React-related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React.
[00:08:20] [5] These could be guessing what library is being used, or this could be a question about some other speaker's topic, which the person that the question is directed to has to answer.
[00:08:33] [5] And then we will use these opportunities to
[00:08:37] [5] kind of segue into more detailed, more in-depth discussions on what their topics are.
[00:08:42] [5] So we still get to, we still have to, or we still get to get a lot of insight from these speakers about what their topic is, what their motivation is behind giving this certain talk, or what their experience has been like
[00:08:58] [5] in this industry, and what kind of things that they have worked on that's bringing them to, like, to React Miami to give this talk.
[00:09:08] [5] It's just structured in a style that's more like a game show, so that it's more fun, and it's more interactive, it's more collaborative.
[00:09:15] [5] We are trying to get the speakers to share experiences with each other as well, and we are trying to get the audience involved.
[00:09:24] [5] By the way, I'm sorry if my phone notification is interrupting me. Put that on silent.
[00:09:31] [5] Yeah, so yeah, that's the point. Trying to make it collaborative, trying to make it engaging.
[00:09:36] [5] We're also going to have some stuff for the audience. So if you are in the audience there in the show, you will also get to engage with the speakers.
[00:09:45] [5] Like, obviously, you'll get to ask your questions, but you might also get to engage in other ways.
[00:09:50] [5] For example, if we ask a question, or if you ask them a question, you can decide how many points they get for answering that question.
[00:09:57] [5] And if the question is about.