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
[00:00:00] All right.  Sorry about the Twitter space kerfuffle.
[00:00:04] Scott got the thing working though. Well done, Scott. I know exactly what was happening. It's happened to me before. Sometimes when you start a space,
[00:00:15] it will show as starting on your phone while having not actually...
[00:00:20] being started where other people can see it and join it.
[00:00:23] But if you wait like one to two minutes,
[00:00:26] Somehow it just works it out and then all of a sudden goes live.  Patience was a virtue in that respect.  So for any other Twitter space hosts out there.
[00:00:37] These are the fun things we get to learn as we do this process.
[00:00:41] Yeah, thank you to the audience for rejoining back and for Scott for soldiering on and Anthony for...
[00:00:50] for the lesson.
[00:00:52] I'm reminded of that old Demotivator poster, which was the Titanic, and it was like, maybe you're
[00:00:58] Your role is to be a lesson for others.
[00:01:00] Um,
[00:01:01] But welcome back, everyone.
[00:01:04] Do you know if Scott's going to join in separately?
[00:01:07] Anthony, I'm going to go
[00:01:09] Let's go ahead and just start announcing things.  Introducing ourselves, we'll let him work out what he's going to do.  Great.
[00:01:16] So hi, everyone. Welcome again to JavaScript Jam Live.
[00:01:20] JavaScript Jam Live is an open mic.
[00:01:24] we like to say for anything JavaScript and web development related,
[00:01:29] is on topic. We love audience participation. We've got something very special for you  this week and in the upcoming weeks in collaboration with React Miami.  I am Ishanand. I'm VP of Product at Egeo, Edge Deployment Platform, and I'm joined by
[00:01:46] Anthony and Scott, I'll let them introduce themselves and talk about what we're doing with React Miami.
[00:01:53] Hello, my name is Anthony Campolo. I am a developer advocate at Egeo, and we're going to be joined today by Dev Agarwal, who is also partnering with React Miami to help put together some sweet events and activities and content.
[00:02:11] for you, and we are bringing him up right now.  And then, Scott, if you are able to speak, go ahead and introduce yourself.  We'll show you.  Yo! What up, everybody?  So, hopefully you can hear me.
[00:02:26] Yes. All right. Great. Wow. Boy, that was fun earlier. I tell you what, you know, it doesn't matter if you know quite a bit about tech or not. There's always something to make you look like a fool. So here we are. Everything's good. Everything's working now.
[00:02:56] And I'm super excited because, you know, as Anthony was sensing out there, we're going to be talking about Dev today and about React Miami and many other things. And also, you know, we're, you know, doing our little collab with React Miami as well. And we're just so excited for that.
[00:03:15] Moving forward, we're going to be having more speakers from React Miami speaking here about just topics that make sense for them.  And we're keeping this traditional JavaScript jam vibe that we have rolling through all that process.  So nothing's going to change as far as what you guys typically are used to hearing.  And as far as having speakers here and all that, it's going to be a great time.  So really, there's just more value actually from us being involved with React Miami, more value for you guys.
[00:03:45] and some extra goodies that we're going to talk about here a little bit later.  We're really excited for.  So thank you so much.  So glad to be here.  Just remember, if you're a beginner or an advanced user,  whether you've been doing this a little bit or doing this for a very long time,  as far as a web developer goes, we want to hear from everybody.  It doesn't matter whether you're a beginner or advanced, like I said.  And so...
[00:04:08] Don't be afraid to request to come up and ask questions or comments or facts, opinions, whatever it is we want to hear from you. In fact, actually, that also helps to increase the value here for everybody listening in because when you guys get involved,
[00:04:22] um typically there's some really great conversations that happen so
[00:04:25] We'd love to hear from as many people as possibly want to come up.  All right. With that being said, I am Scott Steinlongi, and I am a technical community manager at Egeo, and I'm ready to rock this today.  Let's get this rolling. Thank you so much.
[00:04:42] Appreciate y'all.
[00:04:46] Awesome. We should have Dev introduce himself and then after that, Michelle, you can introduce yourself and you're one of the organizers of React Miami. So thank you for joining us.
[00:04:58] How's it going, everybody? Thank you very much for having me up here. Thank everyone for showing up and showing interest.
[00:05:06] My name is Dev, or you can call me Dave. Both work fine.
[00:05:11] And yeah, it's great to be here.  This year, I am also a media partner for React Miami,  along with these two great individuals, Anthony and Scott.
[00:05:21] And yeah, I'm very excited to show you guys what we have in store for next week or talk about it a little today.
[00:05:33] Michelle, you want to go?
[00:05:40] If you're not currently at your mic or something, Dan, you look like you hopped up as well.  I don't think Dan's going to be at React Miami.  I wish.  There's a company off-site for that week.  Otherwise, I would have gone.  But, yeah, I don't think I...
[00:05:55] deserved to introduce myself because I'm not a media partner at React Miami.
[00:06:01] Okay, well cool. Looks like Will showed up anyway, that's so funny.
[00:06:10] Cool. So I guess we can let Dev, do you want to kind of talk about your game show idea? I thought this was pretty interesting.
[00:06:20] Thank you.
[00:06:21] Sure, yeah. So I have managed to rope these two people into hosting a game show with me. This is happening next week. We are calling it Miami Jam.
[00:06:32] And I'm very excited for this.  But it looks like Michelle is back up here as a speaker.
[00:06:39] I think we would like to hear from her first.  Hi, sorry guys.  The connection was on the fritz, and then the microphone button  wasn't working in the Twitter space.  So now it seems like everything's working.  Oh, we understand.  Yeah, so--  That's the normal--
[00:06:57] using Twitter spaces every day.  Yeah.
[00:07:02] Miami and I'm just kind of crashing the party today but I'm super excited to have Dav and  Anthony and Scott all as media partners for React Miami this year and I'm also listening in just  interested to see what we're gonna do because we kind of like just them the green light to do  whatever they like so yeah
[00:07:25] Thanks.
[00:07:28] Yeah, we'll see whether you end up regretting it.
[00:07:31] But I think that will have some cool stuff in store.  So you can probably get back to your description depth.
[00:07:40] Sure, yeah. So the idea of Miami Jam is to kind of stray away from a typical interview or panel style
[00:07:51] show where we just bring on a few speakers and ask them questions. Instead, this show, Miami Jam, which we are hosting, is going to be a little more like a game show, where instead of just straight up asking questions about their topics or their motivations, we are going to ask trivia style questions.
[00:08:12] These can be React-related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React.  These could be guessing what library is being used, or this could be a question about some other speaker's topic, which
[00:08:28] the person that the question is directed to has to answer. And then we will use these opportunities to
[00:08:36] kind of segue into more detailed, more in-depth discussions on
[00:08:41] what their topics are. So we still get to-- we still have to-- we still get to--
[00:08:48] get a lot of insight from these speakers about what their topic is, what their motivation is  behind giving the certain talk, or what their experience has been like,
[00:08:57] in this industry,
[00:08:59] and what kind of things that they have worked on
[00:09:04] that's bringing them to React Miami to give this talk.
[00:09:07] Yeah.
[00:09:08] It's just structured in a style that's more like a game show,  so that it's more fun and it's more interactive,  it's more collaborative.  We are trying to get the speakers to share experiences  with each other as well.  And we are trying to get the audience involved--  by the way, I'm sorry for my phone notification.
[00:09:27] is interrupting me.
[00:09:29] Put that on silent. Yeah, so yeah, that's the point of trying to make it collaborative, trying to make it engaging. We're also going to have some stuff for the audience. So if you are in the audience there in the show, you will, you will also get to engage with the speakers you like obviously you'll get to ask your questions, but you might also get to engage in other ways.
[00:09:50] For example, if we ask a question, or if you ask them a question, you can decide how many points they get for answering that question. And if the question is about