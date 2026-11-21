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
[00:00:01] [S1] All right.
[00:00:01] [S1] Sorry about the Twitter space kerfuffle.
[00:00:04] [S1] Scott got the thing working though.
[00:00:07] [S1] Well done, Scott.
[00:00:09] [S1] I know exactly what was happening is happened to me before sometimes.
[00:00:13] [S1] when you start a space, it will show as starting on your phone while having not actually being started where other people can see it and join it.
[00:00:23] [S1] But if you wait like 1 to 2 minutes, somehow it just works it out and then all of a sudden goes live.
[00:00:30] [S1] So patience was a virtue in that in that respect.
[00:00:33] [S1] So for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process.
[00:00:42] [S2] Yeah, thank you to the audience for for rejoining back and and for Scott for soldiering on and Anthony for for the lesson.
[00:00:52] [S2] I'm reminded of that like old demotivators poster, which was like the Titanic and it was like, maybe your your role is to be a lesson for others.
[00:01:01] [S2] But but welcome back everyone.
[00:01:04] [S2] Do we know if Scott's going to join in separately?
[00:01:07] [S2] Anthony?
[00:01:09] [S1] Let's let's go ahead and just start announcing things, introducing ourselves.
[00:01:13] [S1] We'll let him work out what he's going to do.
[00:01:15] [S1] Great.
[00:01:16] [S2] So hi everyone.
[00:01:17] [S2] Welcome again to JavaScript Jam Live.
[00:01:20] [S2] JavaScript Jam Live is an open mic we like to say for anything JavaScript and web development related is on topic.
[00:01:30] [S2] We love audience participation.
[00:01:32] [S2] We've got something very special for you this week and in the upcoming weeks in collaboration with React Miami.
[00:01:39] [S2] I am Ish Anand.
[00:01:40] [S2] I'm VP of product at Edgeo.
[00:01:43] [S2] Edge deployment platform, and I'm joined by Anthony and Scott.
[00:01:48] [S2] I'll let them introduce themselves and talk about what we're doing with React Miami.
[00:01:54] [S1] Hello, my name is Anthony Campolo.
[00:01:56] [S1] I am a developer advocate at Edgeo.
[00:01:59] [S1] And we're going to be joined today by Dev Agarwal, who is also partnering with React Miami to help put together some sweet events and activities and content for you.
[00:02:12] [S1] And we are bringing him up right now.
[00:02:14] [S1] And then Scott, if you are able to speak, go ahead and introduce yourself.
[00:02:19] [S1] Shelby.
[00:02:20] [S3] Yo.
[00:02:22] [S3] What up everybody?
[00:02:24] [S3] So, hopefully you can hear me.
[00:02:26] [S4] Yes.
[00:02:28] [S3] Alright, great.
[00:02:30] [S3] Wow.
[00:02:30] [S3] Boy, that was fun earlier.
[00:02:31] [S3] I tell you what, you know, it doesn't matter if you know quite a bit about tech or not is there's always something to make you look like a fool.
[00:02:38] [S3] So here we are.
[00:02:39] [S3] Everything's good.
[00:02:40] [S3] Everything's working now.
[00:02:42] [S3] So anyway, so great, so glad to be here.
[00:02:46] [S3] We actually Miami.
[00:02:47] [S3] I don't know why I said week there, but you know, in a hustle to get this up.
[00:02:51] [S3] That's what I put.
[00:02:52] [S3] But really it's reactive Miami month, which I'm renaming right now.
[00:02:57] [S3] And I'm super excited because you know, as Anthony was hinting out there, we're going to be talking about Dev today and about React Miami and many other things.
[00:03:06] [S3] And also, you know, we're, you know, doing our little collab with React Miami as well.
[00:03:13] [S3] And we're just so excited for that.
[00:03:16] [S3] Moving forward, we're going to be having more speakers from React Miami speaking here about just topics that make sense for them.
[00:03:23] [S3] And you know, we're keeping this traditional like JavaScript jam vibe that we have rolling through all that process.
[00:03:29] [S3] So nothing's going to change as far as like what you guys are typically are used to hearing and you know, as far as like having speakers here and all that, it's going to be a great time.
[00:03:37] [S3] So really there's just more value actually from us being involved with React Miami, more value for you guys and some extra goodies that we're going to talk about here a little bit later.
[00:03:48] [S3] We're really excited for So thank you so much.
[00:03:52] [S3] So glad to be here.
[00:03:54] [S3] Just remember, if you're a beginner or an advanced user, whether you've been doing this a little bit or doing this for a very long time as far as a web developer goes, we want to hear from everybody.
[00:04:03] [S3] It doesn't matter whether you're a beginner or advanced, like I said.
[00:04:06] [S3] And so, you know, don't don't be afraid to to request to come up and ask questions or comments or facts, opinions, whatever it is, we want to hear from you.
[00:04:16] [S3] In fact, actually that also helps to increase the value here for everybody listening in because when you guys get involved, typically there's some really great conversations that happen.
[00:04:25] [S3] So we'd love to hear from as many people as is possibly want to come up.
[00:04:30] [S3] So all right, with that being said, I am Scott Steinlage and I am a technical community manager at EGO and I'm ready to rock this today.
[00:04:40] [S3] Let's get this rolling.
[00:04:41] [S3] Thank you so much.
[00:04:42] [S3] Appreciate you all.
[00:04:46] [S1] Awesome.
[00:04:46] [S1] We should have Dev introduce himself and then after that, Michelle, you can introduce yourself and you're one of the organizers of React Miami.
[00:04:55] [S1] So thank you for joining us.
[00:04:59] [S5] How's it going, everybody?
[00:05:01] [S5] Thank you very much for having me up here.
[00:05:02] [S5] Thank everyone for showing up and showing interest.
[00:05:06] [S5] My name is Dev or you can call me Dave.
[00:05:09] [S5] Both work fine.
[00:05:11] [S5] And yeah, it's great to be here.
[00:05:13] [S5] This year I am also a media partner for React Miami along with along with these two great and individuals, Anthony and Scott.
[00:05:21] [S5] And yeah, I'm very excited to show you guys what we have in store for next week or talk about it a little today.
[00:05:34] [S5] Michelle, you want to go?
[00:05:34] [S1] If you're not currently your mic or something, Dan, do looks like you hopped up as well.
[00:05:46] [S1] I don't think Dan's going to be a React Miami.
[00:05:48] [S6] I wish.
[00:05:49] [S6] There's I'm having a there's a company off site for that week.
[00:05:52] [S6] Otherwise, it would have gone.
[00:05:54] [S6] But yeah, I don't think I deserve to introduce myself because I'm not a media part partner at React Miami.
[00:06:02] [S1] Okay well cool.
[00:06:02] [S1] Oh it looks like Will showed up anyway.
[00:06:04] [S1] That's so funny.
[00:06:11] [S1] Cool.
[00:06:11] [S1] So I guess we can let Dev, do you want to kind of talk about your game show idea?
[00:06:17] [S1] I thought this was pretty interesting.
[00:06:21] [S5] Sure.
[00:06:21] [S5] Yeah.
[00:06:22] [S5] So I have managed to rope these two people into hosting a game show with me.
[00:06:27] [S5] This is happening next week.
[00:06:29] [S5] We are calling it Miami Jam.
[00:06:32] [S5] And I'm very excited for this.
[00:06:34] [S5] But it looks like Michelle is back up here as a speaker.
[00:06:36] [S5] So I think we would like to hear her hear from her first.
[00:06:42] [S7] Hi, sorry guys, like the connection was like on the fritz and then the microphone button wasn't working in the Twitter space.
[00:06:48] [S7] So now it seems like everything's working.
[00:06:52] [S3] Oh, we understand.
[00:06:54] [S7] Yeah, so
[00:06:56] [S5] That's the norm of using Twitter spaces every day.
[00:07:02] [S7] Miami, and I'm just kind of crashing the party today, but I'm super excited to have Dev and Anthony and Scott all as media partners for React Miami this year.
[00:07:15] [S7] And I'm also listening in just interested to see what we're going to do because we kind of like just give them the green light to do whatever they like.
[00:07:24] [S1] So Yes, we'll see whether you end up regretting it.
[00:07:32] [S1] But I think that will have some cool stuff in store.
[00:07:35] [S1] So probably get back to your description dev.
[00:07:41] [S5] Sure, yeah.
[00:07:42] [S5] So the idea of Miami Jam is to kind of stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions.
[00:07:55] [S5] Instead, this show, Miami Jam, which we are hosting, is going to be a little more like a game show where instead of just straight up asking questions, about their topics or their motivations, we are going to ask trivia style questions.
[00:08:12] [S5] These can be React related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React.
[00:08:20] [S5] These could be guessing what library is being used, or this could be a question about some some other speaker's topic, which the question, the person that the question is directed to has to answer.
[00:08:33] [S5] And then we will use these opportunities to kind of segue into more detailed, more in-depth discussions on what their topics are.
[00:08:42] [S5] So we still get to, we still have to, or we still get to get a lot of insight from these speakers about what their topic is, what their motivation is behind giving this certain talk, or what their experience has been like in the in this industry and what kind of things that they have worked on that's bringing them to like to React Miami to give this talk.
[00:09:08] [S5] It's just.
[00:09:08] [S5] structured in a style that's more like a game show so that it's more fun and it's more interactive.
[00:09:14] [S5] It's more collaborative.
[00:09:15] [S5] We are trying to get the speakers to share share experiences with each other as well.
[00:09:21] [S5] And we are trying to get the audience involved.
[00:09:24] [S5] By the way, I'm sorry if my phone notification is interrupting me.
[00:09:30] [S5] Put that on silent.
[00:09:32] [S5] Yeah, so yeah, that's the point.
[00:09:33] [S5] Trying to make it collaborative, trying to make it engaging.
[00:09:36] [S5] We are also going to have some stuff for the audience.
[00:09:39] [S5] So if you are in the audience there in the show, you will you will also get to engage with the speakers.
[00:09:45] [S5] You like obviously you'll get to ask your questions, but you might also get to engage in other ways.
[00:09:50] [S5] For example, if we ask a question or if you ask them a question, you can decide how many points they get for answering that question.
[00:09:57] [S5] And if the question is about