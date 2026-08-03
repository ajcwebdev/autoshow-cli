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
[00:00:01] [speaker-A] All right. Sorry about the Twitter space kerfuffle. Scott got the thing working, though. Well done, Scott. I know exactly what was happening. Has happened to me before. Sometimes when you start a space, it will show us starting on your phone while having not actually being started where other people can see it and join it. But if you wait like one to two minutes, somehow it just works it out and then all of a sudden goes live. So patience was a virtue in that. In that respect. So for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process.
[00:00:42] [speaker-B] Yeah. Thank you to the audience for rejoining back and for Scott for soldiering on and Anthony for the lesson. I'm reminded of that, like, old Demotivators poster, which was like the Titanic and it was like, maybe your. Your role is to be a lesson for others. But.
[00:01:02] [speaker-A] But.
[00:01:02] [speaker-B] Welcome back, everyone. Do you know if Scott's gonna join in separately? Anthony, let's.
[00:01:09] [speaker-A] Let's go ahead, just start announcing things, introducing ourselves. We'll let him work out what he's gonna do.
[00:01:15] [speaker-B] Great. So.
[00:01:16] [speaker-C] Hi, everyone.
[00:01:17] [speaker-B] Welcome again to JavaScript Jam Live. JavaScript Jam Live is an open mic we like to say for anything JavaScript and web development related is on topic. We love audience participation. We've got something very special for you this week and in the upcoming weeks in collaboration with React Miami. I am ishanand. I'm VP of Product at edgeo Edge Deployment Platform and I'm joined by Anthony and Scott. I'll let them introduce themselves and talk about what we're doing with react Miami.
[00:01:54] [speaker-A] Hello, my name is Anthony Campolo. I am a developer advocate@edge IO and we're going to be joined today by Dev Agrawal, who is also partnering with react Miami to help put together some sweet events and activities and content for you. And we are bringing him up right now. And then, Scott, if you are able to speak, go ahead, introduce yourself. Michelle here.
[00:02:20] [speaker-D] Yo, what up, everybody? So hopefully you can hear me.
[00:02:26] [speaker-B] Yes.
[00:02:28] [speaker-D] All right, great. Wow. Boy, that was fun earlier. I tell you what, you know, it doesn't matter if you know quite a bit about tech or not, is there's always something to make you look like a fool. So. So here we are. Everything's good, Everything's working now. So anyway, so great. So glad to be here. React Miami. I don't know why I said week there, but, you know, in a hustle to get this up, that's what I put. But really, it's React Miami month, which I'm renaming right now, and I'm super excited because, you know, as Anthony was hinting out there where me talking with Dev today and about React Miami and many other things. And also, you know, we're, we're, you know, doing our little collab with React Miami as well, and we're just so excited for that. Moving forward, we're going to be having, you know, more speakers from React Miami speaking here about just topics that make sense with them. And, you know, we're keeping this traditional, like, JavaScript jam vibe that we have rolling through all that process. So nothing's going to change as far as, like, what you guys typically are used to hearing and, you know, as far as, like, having speakers here and all that, it's going to be a great time. So really there's just more value, actually from us being involved with React Miami, more value for you guys and some extra goodies that we're going to talk about here a little bit later. We're really excited for. So thank you so much. So glad to be here. Just remember, if you're a beginner or an advanced user, whether you've been doing this a little bit or doing this for a very long time, as far as a web developer goes, we want to hear from everybody. It doesn't matter whether you're a beginner or advanced, like I said. And so, you know, don't, don't be afraid to request to come up and ask questions or comments or make facts, opinions, whatever it is, we want to hear from you. In fact, actually, that also helps to increase the value here for everybody listening in, because when you guys get involved, typically there's some really great conversations that happen. So we'd love to hear from as many people as possibly want to come up. So. All right. With that being said, I am Scott Steinlage and I am a technical community manager at Edge Geo, and I'm ready to rock this today. Let's get this rolling. Thank you so much. Appreciate y'. All.
[00:04:46] [speaker-A] Awesome. We should have Dev introduce himself and then after that, Michelle, you can introduce yourself. And you are one of the organizers of React Miami, so thank you for joining us.
[00:04:59] [speaker-C] How's it going, everybody? Thank you very much for having me up here. Thank everyone for showing up and showing interest. My name is Dev, or you can call me Dave. Both work fine. It's great to be here this year. I am also a media partner for React Miami along with these two great individuals, Anthony and Scott. I'm very excited to show you guys what we have in store for next week or talk about it a little today. Michelle, you want to go.
[00:05:41] [speaker-A] If you're not currently at your mic or something? Dan, it looks like you hopped up as well. I don't think Dan's gonna be a React Miami.
[00:05:48] [speaker-E] I. I wish there's. I'm having a. There's a company off site for that week, otherwise it would have gone. But yeah, I don't think I deserve to introduce myself because I'm not a media partner at React Miami.
[00:06:01] [speaker-A] Okay, well, cool. It looks like Will showed up anyway. That's so funny. Cool. So I guess we can let. Dev, do you want to kind of talk about your game show idea? I thought this was pretty interesting.
[00:06:21] [speaker-C] Sure, yeah. So I have managed to rope these two people into hosting a game show with me. This is happening next week. We are calling it Miami Jam and I'm very excited for this. But it looks like Michelle is back up here as a speaker, so I think we would like to hear her hear from her first. Hi.
[00:06:42] [speaker-F] Sorry guys. The connection was like on the fritz and then the microphone button wasn't working in the Twitter space, so it seems like everything's working.
[00:06:52] [speaker-D] Oh, we understand.
[00:06:54] [speaker-F] Yeah.
[00:06:55] [speaker-C] So that's the norm of using Twitter spaces every day,
[00:07:02] [speaker-F] Miami. And I'm just kind of crashing the party today. But I'm super excited to have Dev and Anthony and Scott all as media partners for React Miami this year. And I'm also listening in, just interested to see what we're going to do because we kind of like just them the green light to do whatever they like. So
[00:07:28] [speaker-A] yes, we'll see whether you end up regretting it, but I think that will have some cool stuff in store. So probably get back to your description, Dev.
[00:07:41] [speaker-C] Sure. Yeah. So the idea of Miami Jam is to kind of stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions. Instead, this show, Miami Jam, which we are hosting, is going to be a little more like a game show where instead of just straight up asking questions about their topics or their motivations, we are going to ask trivia style questions. These can be React related questions or anything about weird quirks in JavaScript or TypeScript or anything adjacent to React. These could be guessing what library is being used or this could be a question about some other speaker's topic which the person that the question is directed to has to answer. And then we will use these opportunities to kind of segue into more detailed, more in depth discussions on what their topics are. So we still have to. Or we still get to get a lot of insight from these speakers about what their topic is, what their motivation is behind giving the certain talk, or what their experience has been like in this industry and what kind of things that they have worked on that's bringing them to react Miami to give this talk. It's just structured in a style that's more like a game show so that it's more fun and it's more interactive, it's more collaborative. We are trying to get the speakers to share experiences with each other as well. And we are trying to get the audience involved. By the way, I'm sorry if my phone notification is interrupting me. Put that on silent. That's the point. Trying to make it collaborative, trying to make it engaging. We're also going to have some stuff for the audience. So. So if you are in the audience there in the show, you will also get to engage with the speakers. Obviously, you'll get to ask your questions, but you might also get to engage in other ways. For example, if we ask a question or if you ask them a question, you can decide how many points they get for answering that question. And if the question is about.