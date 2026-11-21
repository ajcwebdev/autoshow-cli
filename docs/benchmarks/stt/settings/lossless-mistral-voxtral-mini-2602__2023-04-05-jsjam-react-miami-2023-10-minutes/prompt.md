---
title: "2023-04-05-jsjam-react-miami-2023-10-minutes"
slug: "2023-04-05-jsjam-react-miami-2023-10-minutes"
duration: "10:00"
channel: "Local"
url: "docs/benchmarks/stt/sources/2023-04-05-jsjam-react-miami-2023-10-minutes.mp3"
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
[00:00:00] [speaker_1] All right.
[00:00:01] [speaker_1] Sorry about the Twitter space kerfuffle.
[00:00:04] [speaker_1] Scott got the thing working, though.
[00:00:07] [speaker_1] Well done, Scott.
[00:00:09] [speaker_1] I know exactly what was happening.
[00:00:11] [speaker_1] It's happened to me before.
[00:00:13] [speaker_1] Sometimes when you start a space, it will show as starting on your phone while having not actually being started for other people can see it and join it.
[00:00:23] [speaker_1] But if you wait like one to two minutes, somehow it just works it out.
[00:00:28] [speaker_1] And then all of a sudden goes live.
[00:00:30] [speaker_1] So patience was a virtue in that respect.
[00:00:33] [speaker_1] So for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process.
[00:00:42] [speaker_2] Yeah, thank you to the audience for rejoining back and for Scott for soldiering on and Anthony for the lesson.
[00:00:52] [speaker_2] I'm reminded of that old Demotivators poster, which was like the Titanic.
[00:00:56] [speaker_2] And it was like, maybe your role is to be a lesson for others.
[00:01:01] [speaker_2] But welcome back, everyone.
[00:01:04] [speaker_2] Do you know if Scott's going to join in separately, Anthony?
[00:01:09] [speaker_1] Let's go ahead and just start announcing things.
[00:01:12] [speaker_1] Introducing ourselves, we'll let him work out what he's going to do.
[00:01:15] [speaker_2] Great.
[00:01:16] [speaker_2] So, hi everyone.
[00:01:17] [speaker_2] Welcome again to JavaScript Jam Live.
[00:01:21] [speaker_2] JavaScript Jam Live is an open mic, we like to say, for anything JavaScript and web development related.
[00:01:30] [speaker_2] on topic.
[00:01:30] [speaker_2] We love audience participation.
[00:01:32] [speaker_2] We've got something very special for you this week and in the upcoming weeks in collaboration with React Miami.
[00:01:39] [speaker_2] I am Ishan Nand.
[00:01:41] [speaker_2] I'm VP of Product at Edge.io, Edge Deployment Platform, and I'm joined by Anthony and Scott.
[00:01:48] [speaker_2] I'll let them introduce themselves and talk about what we're doing with React Miami.
[00:01:54] [speaker_1] Hello, my name is Anthony Campolo.
[00:01:56] [speaker_1] I am a developer advocate at Edgio, and we're going to be joined today by Dev Agarwal, who is also partnering with React Miami to help put together some sweet
[00:02:08] [speaker_1] events and activities and content for you.
[00:02:12] [speaker_1] And we are bringing him up right now.
[00:02:14] [speaker_1] And then Scott, if you are able to speak, go ahead and introduce yourself.
[00:02:19] [speaker_1] Michelle here.
[00:02:20] [speaker_3] Yo, what up, everybody?
[00:02:24] [speaker_3] So hopefully you can hear me.
[00:02:27] [speaker_3] Yes.
[00:02:28] [speaker_3] All right, great.
[00:02:29] [speaker_3] Wow.
[00:02:30] [speaker_3] Boy, that was fun earlier.
[00:02:32] [speaker_3] I tell you what, you know, it doesn't matter if you know quite a bit about tech or not.
[00:02:36] [speaker_3] There's always something to make you look like a fool.
[00:02:38] [speaker_3] So here we are.
[00:02:39] [speaker_3] Everything's good.
[00:02:40] [speaker_3] Everything's working now.
[00:02:42] [speaker_3] So anyway, so great.
[00:02:44] [speaker_3] So glad to be here.
[00:02:46] [speaker_3] React Miami.
[00:02:48] [speaker_3] I don't know why I said week there, but, you know, in a hustle to get this up, that's what I put.
[00:02:52] [speaker_3] But really, it's React Miami Month, which I'm renaming right now.
[00:02:57] [speaker_3] And I'm super excited because, you know,
[00:03:00] [speaker_3] As Anthony was hinting at there, we're going to be talking about Dev today and about React Miami and many other things.
[00:03:06] [speaker_3] And also, you know, we're, you know, doing our little collab with React Miami as well.
[00:03:13] [speaker_3] And we're just so excited for that.
[00:03:16] [speaker_3] Moving forward, we're going to be having more speakers from React Miami speaking here about just topics that make sense with them.
[00:03:23] [speaker_3] And we're keeping this traditional JavaScript jam vibe that we have rolling through all that process.
[00:03:29] [speaker_3] So nothing's going to change as far as what you guys typically are used to hearing.
[00:03:33] [speaker_3] And as far as having speakers here and all that, it's going to be a great time.
[00:03:37] [speaker_3] So really, there's just more value actually from us being involved with React Miami, more value for you guys.
[00:03:45] [speaker_3] And some extra goodies that we're going to talk about here a little bit later.
[00:03:48] [speaker_3] We're really excited for.
[00:03:50] [speaker_3] So thank you so much.
[00:03:52] [speaker_3] So glad to be here.
[00:03:54] [speaker_3] Just remember, if you're a beginner or an advanced user, whether you've been doing this a little bit or doing this for a very long time, as far as a web developer goes, we want to hear from everybody.
[00:04:03] [speaker_3] It doesn't matter whether you're a beginner or advanced, like I said.
[00:04:06] [speaker_3] And so, you know, don't be afraid to request to come up and ask questions or comments or facts, opinions, whatever it is.
[00:04:15] [speaker_3] We want to hear from you.
[00:04:16] [speaker_3] In fact, actually, that also helps to increase the value here for everybody listening in, because when you guys get involved.
[00:04:22] [speaker_3] Typically, there's some really great conversations that happen.
[00:04:25] [speaker_3] So we'd love to hear from as many people as possibly want to come.
[00:04:30] [speaker_3] So, all right.
[00:04:31] [speaker_3] With that being said, I am Scott Steinlongi, and I am a technical community manager at Edgeo, and I'm ready to rock this today.
[00:04:40] [speaker_3] Let's get this rolling.
[00:04:41] [speaker_3] Thank you so much.
[00:04:42] [speaker_3] Appreciate y'all.
[00:04:46] [speaker_1] Awesome.
[00:04:46] [speaker_1] We should have Dev introduce himself, and then after that, Michelle, you can introduce yourself.
[00:04:52] [speaker_1] And you are one of the organizers of React Miami, so thank you for joining us.
[00:04:59] [speaker_4] How's it going, everybody?
[00:05:01] [speaker_4] Thank you very much for having me up here.
[00:05:03] [speaker_4] Thank everyone for showing up and showing interest.
[00:05:06] [speaker_4] My name is Dev, or you can call me Dave.
[00:05:09] [speaker_4] Both work fine.
[00:05:11] [speaker_4] And yeah, it's great to be here.
[00:05:13] [speaker_4] This year, I am also a media partner for React Miami, along with these two great individuals, Anthony and Scott.
[00:05:21] [speaker_4] And yeah, I'm very excited to show you guys what we have in store for next week or talk about it a little today.
[00:05:34] [speaker_1] Michelle, you want to go?
[00:05:41] [speaker_1] If you're not currently at your mic or something, Dan, you look like you hopped up as well.
[00:05:46] [speaker_1] I don't think Dan's going to be at React Miami.
[00:05:48] [speaker_5] I wish.
[00:05:49] [speaker_5] I'm having a...
[00:05:50] [speaker_5] There's a company off-site for that week.
[00:05:52] [speaker_5] Otherwise, I would have gone.
[00:05:54] [speaker_5] But, yeah, I don't think I deserve to introduce myself because I'm not a media partner at React Miami.
[00:06:02] [speaker_1] Okay, well, cool.
[00:06:02] [speaker_1] Oh, it looks like Will showed up anyway.
[00:06:04] [speaker_1] That's so funny.
[00:06:11] [speaker_1] Cool.
[00:06:11] [speaker_1] So I guess we can let Dev, do you want to kind of talk about your game show idea?
[00:06:17] [speaker_1] I thought this was pretty interesting.
[00:06:21] [speaker_4] Sure, yeah.
[00:06:22] [speaker_4] So I have managed to rope these two people into hosting a game show with me.
[00:06:27] [speaker_4] This is happening next week.
[00:06:29] [speaker_4] We are calling it Miami Jam.
[00:06:32] [speaker_4] And I'm very excited for this.
[00:06:34] [speaker_4] But it looks like Michelle is back up here as a speaker.
[00:06:36] [speaker_4] So I think we would like to hear her.
[00:06:41] [speaker_4] Hear from her first.
[00:06:42] [speaker_6] Hi, sorry guys, like the connection was like on the fritz and then the microphone button wasn't working in the Twitter space.
[00:06:48] [speaker_6] So that seems like everything's working.
[00:06:52] [speaker_4] Oh, we understand.
[00:06:54] [speaker_6] Yeah, so that's the normal experience of using Twitter spaces every day.
[00:07:02] [speaker_6] Miami and I'm just kind of crashing the party today, but I'm super excited to have Dav and, um, and any and Scott all as media partners for react Miami this year.
[00:07:15] [speaker_6] And I'm also listening in just interested to see what we're going to do because we kind of like just them the green light to do whatever they like.
[00:07:24] [speaker_6] So.
[00:07:28] [speaker_1] Yes, we'll see whether you end up regretting it.
[00:07:32] [speaker_1] But I think that will have some cool stuff in store.
[00:07:35] [speaker_1] So you can probably get back to your description, Dev.
[00:07:41] [speaker_4] Sure, yeah.
[00:07:42] [speaker_4] So the idea of Miami Jam is to kind of stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions.
[00:07:55] [speaker_4] Instead, this show, Miami Jam, which we are hosting, is going to be a little more like a game show where instead of just straight up asking questions about their topics or their motivations,
[00:08:08] [speaker_4] we are going to ask trivia style questions.
[00:08:12] [speaker_4] These can be React-related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React.
[00:08:20] [speaker_4] These could be guessing what library is being used, or this could be a question about some other speaker's topic, which the question...
[00:08:29] [speaker_4] the person that the question is directed to has to answer.
[00:08:33] [speaker_4] And then we will use these opportunities to kind of segue into more detailed, more in-depth discussions on what their topics are.
[00:08:42] [speaker_4] So we still get to, we still have to, or we still get to
[00:08:48] [speaker_4] get a lot of insight from these speakers about what their topic is, what their motivation is behind giving this certain talk, or what their experience has been like in this industry, and
[00:09:01] [speaker_4] what kind of things that they have worked on that's bringing them to React Miami to give this talk.
[00:09:08] [speaker_4] It's just structured in a style that's more like a game show so that it's more fun and it's more interactive.
[00:09:14] [speaker_4] It's more collaborative.
[00:09:15] [speaker_4] We are trying to get the speakers to share experiences with each other as well.
[00:09:21] [speaker_4] And we are trying to get the audience involved.
[00:09:24] [speaker_4] By the way, I'm sorry if my phone notification.
[00:09:27] [speaker_4] Is interrupting me.
[00:09:30] [speaker_4] Put that on silent.
[00:09:31] [speaker_4] Yeah, so yeah, that's the point of trying to make it collaborative, trying to make it engaging.
[00:09:36] [speaker_4] We're also going to have some stuff for the audience.
[00:09:39] [speaker_4] So if you are in the audience there in the show, you will also get to engage with the speakers.
[00:09:46] [speaker_4] Obviously, you'll get to ask your questions, but you might also get to engage in other ways.
[00:09:50] [speaker_4] For example, if we ask a question or if you ask them a question, you can decide how many points they get for answering that question.
[00:09:57] [speaker_4] And if the question is about