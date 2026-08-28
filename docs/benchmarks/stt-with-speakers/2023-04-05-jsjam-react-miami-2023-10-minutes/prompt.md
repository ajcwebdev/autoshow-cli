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
[00:00:01] [speaker-0] Alright,
[00:00:01] [speaker-0] sorry about the Twitter space kerfuffle.
[00:00:05] [speaker-0] Got the thing working though.
[00:00:07] [speaker-0] Well done,
[00:00:08] [speaker-0] Scott.
[00:00:09] [speaker-0] I know exactly what was happening.
[00:00:11] [speaker-0] It's happened to me before.
[00:00:13] [speaker-0] Sometimes when you start a space,
[00:00:15] [speaker-0] it will show as starting on your phone while having not actually being started where other people can see it and join it.
[00:00:23] [speaker-0] But if you wait like one to two minutes,
[00:00:27] [speaker-0] somehow it just works it out.
[00:00:28] [speaker-0] And then all of a sudden it goes off.
[00:00:30] [speaker-0] so patience was a virtue in that in that respect so for any other twitter space hosts out there these are the fun things we get to learn as we do this process yeah thank you uh to the audience for for rejoining back and uh and
[00:00:47] [speaker-1] for scott for soldiering on and anthony for for the lesson uh i'm reminded of that like old demotivators poster which was like the titanic and it was like maybe you're
[00:00:58] [speaker-0] your role is to be a lesson for others um but uh but welcome back everyone um do you know if scott's going to join in separately anthony uh let's let's go ahead just start announcing things introducing ourselves we'll let him work work out what he's going to do great so
[00:01:16] [speaker-1] hi everyone welcome again to javascript jam live uh javascript jam live is an open mic
[00:01:24] [speaker-1] We like to say for anything JavaScript and web development related is on topic.
[00:01:30] [speaker-1] We love audience participation.
[00:01:32] [speaker-1] We've got something very special for you this week and in the upcoming weeks in collaboration with React Miami.
[00:01:39] [speaker-1] I am Ishan Nand.
[00:01:40] [speaker-1] I'm VP of product at Egeo,
[00:01:43] [speaker-1] Edge deployment platform.
[00:01:45] [speaker-1] And I'm joined by
[00:01:47] [speaker-1] Anthony and Scott.
[00:01:48] [speaker-1] I'll let them introduce themselves and talk about what we're doing with
[00:01:51] [speaker-1] React Miami.
[00:01:54] [speaker-0] Hello,
[00:01:54] [speaker-0] my name is Anthony Campolo.
[00:01:56] [speaker-0] I am a developer advocate at Egeo,
[00:01:59] [speaker-0] and we're going to be joined today by Dev Agarwal,
[00:02:03] [speaker-0] who is also partnering with React Miami to help put together some sweet events and activities and content for you.
[00:02:12] [speaker-0] And we are bringing him up right now.
[00:02:14] [speaker-0] And then Scott,
[00:02:15] [speaker-0] if you are able to speak,
[00:02:16] [speaker-0] go ahead and introduce yourself.
[00:02:20] [speaker-2] Yo,
[00:02:22] [speaker-2] what up?
[00:02:22] [speaker-2] everybody so hopefully you can hear me yes all right great wow boy that was fun earlier i tell you what you know uh it doesn't matter if you know quite a bit about tech or not is there's always something to make you look like a fool so here we are everything's
[00:02:40] [speaker-2] good everything's working now um so anyway so great so glad to be here uh react miami i don't i don't know why i said week there,
[00:02:49] [speaker-2] but you know,
[00:02:50] [speaker-2] in a hustle to get this up,
[00:02:51] [speaker-2] that's what I put.
[00:02:52] [speaker-2] but really it's React Miami
[00:02:54] [speaker-2] Month, which I'm renaming right now.
[00:02:57] [speaker-2] And
[00:02:58] [speaker-2] I'm super excited because,
[00:02:59] [speaker-2] you know,
[00:03:00] [speaker-2] as Anthony was hinting at there,
[00:03:02] [speaker-2] we're going to be talking about Dev today and about React Miami and many other things.
[00:03:06] [speaker-2] And also,
[00:03:09] [speaker-2] you know,
[00:03:09] [speaker-2] we're doing our little collab with
[00:03:12] [speaker-2] React Miami as well.
[00:03:13] [speaker-2] And we're just so excited for that.
[00:03:16] [speaker-2] Moving forward,
[00:03:16] [speaker-2] we're going to be having more speakers.
[00:03:19] [speaker-2] from
[00:03:19] [speaker-2] React Miami speaking here about just topics that make sense with them.
[00:03:23] [speaker-2] And,
[00:03:23] [speaker-2] you know,
[00:03:23] [speaker-2] we're keeping this traditional like JavaScript jam vibe that we have rolling through all that process.
[00:03:29] [speaker-2] So nothing's going to change as far as like what you guys typically are used to hearing.
[00:03:33] [speaker-2] And,
[00:03:34] [speaker-2] you know,
[00:03:34] [speaker-2] as far as like having speakers here and all that,
[00:03:36] [speaker-2] it's going to be a great time.
[00:03:37] [speaker-2] So really there's just more value actually from us being involved with React Miami,
[00:03:43] [speaker-2] more value for you guys and some extra goodies that we're going to talk about here a little bit later.
[00:03:49] [speaker-2] really excited for.
[00:03:50] [speaker-2] So thank you so much.
[00:03:52] [speaker-2] So glad to be here.
[00:03:54] [speaker-2] Just remember,
[00:03:54] [speaker-2] if you're a beginner or an advanced user,
[00:03:56] [speaker-2] whether you've been doing this a little bit or doing this for a very long time,
[00:04:00] [speaker-2] as far as a web developer goes,
[00:04:02] [speaker-2] we want to hear from everybody.
[00:04:03] [speaker-2] It doesn't matter whether you're a beginner or advanced,
[00:04:06] [speaker-2] like I said.
[00:04:06] [speaker-2] And so don't be afraid to request to come up and ask questions or comments or facts,
[00:04:14] [speaker-2] opinions,
[00:04:14] [speaker-2] whatever it is,
[00:04:15] [speaker-2] we want to hear from you.
[00:04:16] [speaker-2] In fact,
[00:04:17] [speaker-2] actually,
[00:04:17] [speaker-2] that also helps to increase the value here for everybody listening in,
[00:04:20] [speaker-2] because when you guys get involved,
[00:04:22] [speaker-2] typically there's some really great conversations that happen.
[00:04:25] [speaker-2] So we'd love to hear from as many people as possibly want to come up.
[00:04:30] [speaker-2] So,
[00:04:31] [speaker-2] all right.
[00:04:31] [speaker-2] With that being said,
[00:04:32] [speaker-2] I am Scott Steinlong and I am a technical community manager at Egeo.
[00:04:37] [speaker-2] And I'm ready to rock this today.
[00:04:40] [speaker-2] Let's get this rolling.
[00:04:41] [speaker-2] Thank you so much.
[00:04:42] [speaker-2] Appreciate y'all.
[00:04:46] [speaker-0] Awesome.
[00:04:46] [speaker-0] We should have
[00:04:47] [speaker-0] Dev introduce himself,
[00:04:49] [speaker-0] and then after that,
[00:04:50] [speaker-0] Michelle,
[00:04:51] [speaker-0] you can introduce yourself.
[00:04:52] [speaker-0] And you are one of the organizers of React Miami,
[00:04:55] [speaker-0] so thank you for joining us.
[00:04:59] [speaker-3] How's it going,
[00:05:00] [speaker-3] everybody?
[00:05:01] [speaker-3] Thank you very much for having me up here.
[00:05:02] [speaker-3] Thank everyone for showing up and showing interest.
[00:05:06] [speaker-3] My name is Dev,
[00:05:07] [speaker-3] or you can call me Dave.
[00:05:09] [speaker-3] Both work fine.
[00:05:11] [speaker-3] And yeah,
[00:05:11] [speaker-3] it's great to be here.
[00:05:13] [speaker-3] This year,
[00:05:13] [speaker-3] I am also a media partner for React Miami along with along with these two great individuals,
[00:05:20] [speaker-3] Anthony and Scott.
[00:05:21] [speaker-3] And yeah,
[00:05:22] [speaker-3] I'm very excited to show you guys what we have in store for next week,
[00:05:26] [speaker-3] or talk about it a little today.
[00:05:34] [speaker-3] Michelle,
[00:05:34] [speaker-3] do you want to go?
[00:05:41] [speaker-0] If you're not currently at your mic or something,
[00:05:44] [speaker-0] Dan,
[00:05:44] [speaker-0] you look like you hopped up as well.
[00:05:46] [speaker-0] I don't think Dan's going to be at React Miami.
[00:05:48] [speaker-4] I wish.
[00:05:50] [speaker-4] There's a company off-site for that week.
[00:05:52] [speaker-4] Otherwise,
[00:05:53] [speaker-4] I would have gone.
[00:05:54] [speaker-4] But yeah,
[00:05:54] [speaker-4] I don't think I deserve to introduce myself because I'm not a media partner at React Miami.
[00:06:02] [speaker-0] Okay,
[00:06:02] [speaker-0] well cool.
[00:06:02] [speaker-0] Oh,
[00:06:02] [speaker-0] it looks like Will showed up anyway,
[00:06:04] [speaker-0] that's so funny.
[00:06:11] [speaker-0] Cool,
[00:06:11] [speaker-0] so I guess we can let
[00:06:13] [speaker-0] Dev, do you want to kind of talk about your game show idea?
[00:06:17] [speaker-0] I thought this was pretty interesting.
[00:06:21] [speaker-3] Sure,
[00:06:21] [speaker-3] yeah.
[00:06:22] [speaker-3] So I have managed to rope these two people into hosting a game show with me.
[00:06:27] [speaker-3] This is happening next week.
[00:06:29] [speaker-3] We are calling it Miami Jam.
[00:06:32] [speaker-3] And I'm very excited for this.
[00:06:34] [speaker-3] But it looks like Michelle is back up here as a speaker.
[00:06:36] [speaker-3] So
[00:06:39] [speaker-3] I think we would like to hear from her first.
[00:06:42] [speaker-5] Hi.
[00:06:43] [speaker-5] Sorry,
[00:06:43] [speaker-5] guys.
[00:06:44] [speaker-5] The connection was on the fritz,
[00:06:46] [speaker-5] and then the microphone button wasn't working in the Twitter space.
[00:06:48] [speaker-5] So it seems like everything's working.
[00:06:52] [speaker-2] Oh,
[00:06:52] [speaker-2] we understand.
[00:06:54] [speaker-5] Yeah.
[00:06:56] [speaker-3] That's the norm.
[00:06:57] [speaker-3] Using Twitter spaces every day.
[00:07:02] [speaker-5] Miami and I'm just kind of crashing the party today,
[00:07:05] [speaker-5] but I'm super excited to have Davin and Annie and Scott all as media partners for React Miami this year.
[00:07:15] [speaker-5] And I'm also listening in,
[00:07:17] [speaker-5] just interested to see what we're going to do because we kind of like just them the green light to do whatever they like.
[00:07:28] [speaker-0] Yes,
[00:07:29] [speaker-0] we'll see whether you end up regretting it,
[00:07:32] [speaker-0] but I think that will have some cool stuff in store.
[00:07:35] [speaker-0] So we'll probably get back to your description,
[00:07:38] [speaker-0] Dev.
[00:07:41] [speaker-3] Sure,
[00:07:41] [speaker-3] yeah.
[00:07:42] [speaker-3] So the idea of Miami Jam is to kind of stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions.
[00:07:55] [speaker-3] Instead,
[00:07:55] [speaker-3] the...
[00:07:57] [speaker-3] this show Miami Jam which we are hosting is going to be a little more like a game show where instead of just straight up asking questions about their topics or their motivations we are going to ask trivia style questions.
[00:08:12] [speaker-3] These can be React related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React.
[00:08:20] [speaker-3] These could be guessing what library is being used or this could be a question about some
[00:08:26] [speaker-3] some other speaker's topic which the person that the question is directed to has to answer.
[00:08:33] [speaker-3] And then we will use these opportunities to kind of segue into more detailed,
[00:08:39] [speaker-3] more in-depth discussions on what their topics are.
[00:08:42] [speaker-3] So we still get to get a lot of insight from these speakers about what their topic is,
[00:08:52] [speaker-3] what their motivation is behind giving the certain talk.
[00:08:55] [speaker-3] or what their experience has been like in this industry,
[00:09:00] [speaker-3] and what kind of things that they have worked on that's bringing them to React Miami to give this talk.
[00:09:08] [speaker-3] It's just structured in a style that's more like a game show so that it's more fun and it's more interactive,
[00:09:14] [speaker-3] it's more collaborative.
[00:09:15] [speaker-3] We are trying to get the speakers to share experiences with each other as well,
[00:09:21] [speaker-3] and we are trying to get the audience involved.
[00:09:24] [speaker-3] By the way,
[00:09:24] [speaker-3] I'm sorry if my phone notification is interrupting me.
[00:09:30] [speaker-3] Put that on silent.
[00:09:32] [speaker-3] Yeah,
[00:09:32] [speaker-3] so yeah,
[00:09:32] [speaker-3] that's the point of trying to make it collaborative,
[00:09:34] [speaker-3] trying to make it engaging.
[00:09:37] [speaker-3] We're also going to have some stuff for the audience.
[00:09:39] [speaker-3] So if you are in the audience there in the show,
[00:09:42] [speaker-3] you will,
[00:09:43] [speaker-3] you will also get to engage with the speakers you like,
[00:09:46] [speaker-3] obviously,
[00:09:46] [speaker-3] you will get to ask your questions.
[00:09:48] [speaker-3] But you might also get to engage in other ways.
[00:09:50] [speaker-3] For example,
[00:09:51] [speaker-3] if we ask a question or if you ask them a question.
[00:09:54] [speaker-3] you can decide how many points they get for answering that question.
[00:09:57] [speaker-3] And if the question is about