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
[00:00:00] Alright, sorry about the Twitter space kerfuffle. Scott got the thing working though. Well done, Scott. I know exactly what was happening. It has happened to me before. Sometimes when you start a space
[00:00:15] it will show as starting on your phone while having not actually being started where other people can see it and join it. But if you wait like one to two minutes, somehow it just works it out and then all of a sudden goes live. So
[00:00:31] Patience was a virtue in that in that respect. So for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process. Yeah, thank you uh to the audience for for rejoining back and uh
[00:00:47] And for Scott for soldiering on and Anthony for for the lesson. Uh I'm reminded of that like old demotivators poster which was like the Titanic and it was like maybe your your role is to be a lesson for others. Um
[00:01:01] But uh but welcome back everyone. Um do we know if Scott's gonna join in separately, Anthony? Uh let's let's go ahead and just start announcing things, introducing ourselves, we'll let him work out what he's gonna do.
[00:01:16] So hi everyone, welcome again to JavaScript Jam Live. Uh JavaScript Jam Live is an open mic, uh, we like to say for anything JavaScript and web development related uh is on topic.
[00:01:30] We love audience participation. We've got something very special for you uh this week and in the upcoming weeks in collaboration with React Miami. Um I am Ishanand, I'm VP of product at EGIO, uh Edge deployment platform, and I'm joined by
[00:01:46] Uh Anthony and Scott, I'll let them introduce themselves and talk about what we're doing with uh React Miami. Hello, my name is Anthony Campolo. I am a developer advocate at EGIO, and we're going to be joined today
[00:02:01] by Dev Agarwal, who is also partnering with React Miami to help put together some sweet events and activities and content for you. And we are bringing him up right now. And then Scott, if you are able
[00:02:16] to speak. Go ahead. Introduce yourself. Yo. What up everybody? So hopefully you can hear me. Yes. Alright, great. Wow.
[00:02:30] Boy, that was fun earlier. I tell you what, you know, uh it doesn't matter if you know quite a bit about tech or not, is there's always something to make you look like a fool. So here we are. Everything's good, everything's working now. Um, so anyway, so great so glad to be here.
[00:02:45] Um React Miami I don't I don't know why I said week there, but you know, in a hustle to get this up, that's what I put. But really it's React Miami month, which I'm renaming right now. And um I'm super excited because, you know, um
[00:03:00] as Anthony was sensing at there, we're gonna be talking about dev today and uh about React Miami and many other things. And uh also, you know, we're we're uh you know doing our little collab with uh React Miami as well and we're just so excited for that.
[00:03:15] Um moving forward, we're gonna be having uh you know more speakers uh from React Miami speaking here um about just topics that make sense with them. And you know, we're keeping this traditional like JavaScript jam vibe that we have uh rolling through all that process. So nothing's gonna change.
[00:03:31] as far as like what you guys uh typically are used to hearing and and you know as has as far as like having speakers here and all that, it's gonna be a great time. So um really there's just more value actually from uh us being involved with React Miami, more value for you guys. Um
[00:03:45] and and some extra goodies that we're gonna talk about here a little bit later. We're uh really excited for. So um thank you so much. So glad to be here. Um just remember if you're a beginner or or an advanced user, whether you've been you know doing this a little bit or doing this for a very long time as far as a web developer goes.
[00:04:01] Uh we want to hear from everybody. It doesn't matter whether you're a beginner or advanced, like I said. And so um, you know, don't for don't don't be afraid to to request to come up and ask questions or um comments or like facts, opinions, whatever it is.
[00:04:15] We want to hear from ya. In fact, actually that also helps to increase the value here for everybody listening in because when you guys get involved, um typically there's some really great conversations that happen. So we'd love to hear from as many people as as uh possibly wanna come up. So
[00:04:31] All right, with that being said, I am Scott Steinlonge and I am a technical community manager at EGEO, and I'm ready to rock this today. Let's get this rolling. Thank you so much. Appreciate y'all.
[00:04:45] Awesome. We should have um Dev introduce himself and then after that, um Michelle, you can introduce yourself. And you're one of the organizers of React Miami. So thank you for joining us.
[00:04:59] How's it going everybody? Thank you very much for having me up here. Thank you everyone for showing up and showing interest. My name is Dev or you can call me Dave. Uh both work fine. And yeah, it's great to be here. This year I am
[00:05:14] Also a media partner for React Miami along with along with these two great individuals, Anthony and Scott. And uh yeah, I'm very excited to show you guys what we have in store for next week or talk about it a little today.
[00:05:30] Michelle, you wanna go? If you're not currently having your mic or something, Dan.
[00:05:44] It looks like you hopped up as well. I don't think Dan's gonna be at React Miami. I I wish. There's I'm having a there's a company off site for that week, otherwise I would have gone. But yeah, I don't think I deserve to introduce myself because I'm not a media partner at React React Miami.
[00:05:59] Okay, well cool. Oh it looks like Will showed up anyway. That's so funny. Um cool. So I guess we can let um Dev uh do you wanna kind of
[00:06:15] Talk about your game show idea. I thought this was pretty interesting. Sure, yeah. So I have managed to robe these two people into hosting a game show with me. Uh this is happening next week.
[00:06:29] We are calling it Miami Jam. And I'm very excited for this. Uh but looks like Michelle is back up here as a speaker, so uh think we would like to hear her hear from her first. Hi, sorry guys, like uh the connection was
[00:06:45] like on the fritz and then the microphone button wasn't working in the Twitter space so now it seems like everything's working. Um we understand. But yeah, so um That's the normal expensive of using Twitter spaces every day. Don't we
[00:07:00] Miami and I'm just kind of crashing the party today, but I'm super excited to have Dav and um Anthony and Scott all as media partners for React Miami this year and I'm also
[00:07:16] listening in just interested to see what we're gonna do because we kind of like just give them the green light to do whatever they like. So yes, we'll see whether you end up regretting it.
[00:07:32] But I think that will have some some cool stuff in store. So um you can probably get back to your description dev Sure, yeah. So the idea of Miami Jam is to kind of
[00:07:46] uh stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions. Instead the uh this show, Miami Jam, which we are hosting, is going to be a little more like a game show.
[00:08:02] Where instead of just straight up asking questions about their topics or uh their motivations, uh, we are going to ask trivia style questions. These can be React related questions or anything about uh weird quirks in JavaScript or types.
[00:08:17] Or anything adjacent to React. These could be guessing what library is being used, or this could be a question about some some other speaker's topic, which the person that the question is directed to has to answer.
[00:08:33] And then uh we will use these opportunities to um kind of segue into more detailed, more in-depth discussions on what their topics are. So we still get to uh we still have to uh or we still get to um
[00:08:48] get a lot of insight from these speakers about what their topic is, what their motivation is behind giving this certain talk, or what their experience has been like in the in this industry and what kind of things that they have worked on.
[00:09:04] that's bringing them to like to React Miami to give this talk. It's just structured in a style that's more like a game show so that it's more fun and it's more interactive. It's more collaborative. Uh we're trying to get the speakers to uh
[00:09:18] share as share experiences with each other as well. And we are trying to get uh the audience involved. By the way, I'm sorry if my phone notification is interrupting me. Put that on silent. Yeah, so yeah, that's the point.
[00:09:33] uh trying to make it collaborative, trying to make it engaging. We're also going to have some stuff for the audience. So if you are in the audience there in the show, you will uh you will also get to engage with the speakers. You like obviously you'll get to ask your questions.
[00:09:48] But you might also get to engage in other ways. For example, if we ask a question or if you ask them a question, you can decide how many points they get for answering that question. And uh if the question is about