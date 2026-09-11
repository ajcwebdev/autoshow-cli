---
title: "2023-04-05-jsjam-react-miami-2023-10-minutes"
slug: "2023-04-05-jsjam-react-miami-2023-10-minutes"
duration: "10:00"
channel: "Local"
url: "file:///Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/2023-04-05-jsjam-react-miami-2023-10-minutes.mp3"
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
[00:00:00] All right, sorry about the Twitter space. Careful, got the thing working though. Well done, Scott. I know exactly what was happening has happened to me before, sometimes when you start a space, it will show as starting on your phone while having not actually
[00:00:20] Being started where other people can see it and join it. But if you wait like one to two minutes, somehow it just works it out. And then all of a sudden goes on and starts out.
[00:00:31] Patience was a virtue in that respect. So for any other Twitter space hosts out there, these are the fun things we get to learn as we do this process. Yeah, thank you to the audience for rejoining back and for Scott for soldering on
[00:00:49] And Anthony for, for the lesson. I'm reminded of that old demotivator poster, which was like the Titanic, and it was like, maybe your role is to be a lesson for others. But welcome back, everyone.
[00:01:04] Do you know Scott's going to join in separately? Anthony? Let's go ahead and just start announcing things that you're seeing ourselves. We'll put him work work that he's going to do. Great. So hi, everyone.
[00:01:17] Welcome again to JavaScript Jam Live. JavaScript Jam Live is an open mic. We'd like to say for anything JavaScript and web development related is on topic. We love audience participation. We've got something very special for you this week.
[00:01:35] And in the upcoming weeks in collaboration with React Miami, I am Isha Nand. I'm VP of product at Egio, Edge Department platform. And I'm joined by Anthony and Scott. I'll let them introduce themselves.
[00:01:49] And talk about what we're doing with React Miami. Hello, my name is Anthony Campolo. I am a developer advocate at Egio. And we're going to be joined today by Dev Aguau, who was also partnering with React Miami to help put together some sweet
[00:02:08] Events and activities and content for you. And we are bringing him up right now. And then Scott, if you are able to speak, go ahead and introduce yourself. That's all you. Yo, what up, everybody?
[00:02:24] So hopefully you can hear me. Yes. All right, great. Wow. Boy, that was fun earlier. I tell you what, it doesn't matter if you know quite a bit about tech or not. There's always something to make you look like a fool.
[00:02:38] So here we are, everything's good, everything's working now. So anyway, so great. So glad to be here. React Miami, I don't know why I said week there, but you know, and also to get this up, that's what I put.
[00:02:52] But really, it's React Miami months, which I'm renaming right now. And I'm super excited, because as Anthony was sensing out there, we're going to talk about Dev today and about React Miami and many other things.
[00:03:06] And also, we're doing our little collab with React Miami as well. And we're just so excited for that moving forward. We're going to be having more speakers from React Miami speaking here about just topics that make sense for them.
[00:03:23] And we're keeping this traditional JavaScript jam vibe that we have rolling through all that process. So nothing's going to change as far as what you guys are typically are used to hearing. And as far as having speakers here and all that, it's going
[00:03:36] To be a great time. So really, there's just more value, actually, from us being involved with React Miami, more value for you guys. And some extra goodies that we're going to talk about here a little bit later, which really excited for us.
[00:03:50] So thank you so much so glad to be here. Just remember, if you're a beginner or an advanced user, whether you're doing this a little bit or doing this for a very long time, as far as a web developer goes, we want to
[00:04:02] Hear from everybody. It doesn't matter whether you're a beginner or advanced, like I said. And so don't be afraid to request to come up and ask questions or comments or facts, opinions, whatever it is.
[00:04:15] We want to hear from you. And in fact, actually, that also helps to increase the value here for everybody listening in, because when you guys get involved, typically there's some really great conversations that happen.
[00:04:25] So I would love to hear from as many people as possibly want to come up. So all right, with that being said, I am Scott Simon again. And I am a technical community manager at Egio.
[00:04:37] And I'm ready to rock this today. Let's get this rolling. Thank you so much. Appreciate y'all. Awesome, we should have a dev introduced himself. And then after that, Michelle, you can introduce yourself. And you're one of the organizers of react to my area.
[00:04:55] So thank you for joining us. How's it going, everybody? Thank you very much for having me up here. Thank everyone for showing up and showing interest. My name is Dev or it can call me Dave, both work fine.
[00:05:11] And yeah, it's great to be here this year. I am also a media partner for react Miami along with these two great individuals Anthony and Scott. And yeah, I'm very excited to show you guys what we have in store for next week or
[00:05:27] Talk about it a little today. Michelle, you want to go?
[00:05:41] If you're not currently either Microsoft and Dan people like you hopped up as well. I don't think Dan's going to be a react Miami. I wish there's a company offsite for that week otherwise would have gone.
[00:05:54] But yeah, I don't think I deserve to introduce myself because I'm not a media partner at react Miami. OK, we'll cool. Oh, it looks like we'll show it up anyway, that's a funny.
[00:06:11] Cool, so I guess we can, but Dev, do you want to kind of talk about your game show idea? I thought it was pretty interesting. Sure, yeah. So I have managed to rub these two people into hosting a game show with me.
[00:06:27] This is happening next week. We are calling it Miami Jam and I'm very excited for this. But it looks like Michelle is back up here as a speaker. So I think we would like to hear her hear from her first.
[00:06:42] Hi, sorry guys. Like the connection was like on the fruits and then the microphone button wasn't working in the Twitter space. So it seems like everything's working. Oh, we understand. Yeah, so that's the norm of using Twitter space as every day.
[00:06:58] Miami, and I'm just kind of crashing the party today. But I'm super excited to have Dev and Anthony and Scott all as media partners for Miami this year, and I'm also listening in just interested to see what we're going to do because we
[00:07:20] Kind of like just them the green light to do whatever they like. Yeah, we'll see whether you're never ready yet. But I think that will have some cool stuff in store. So we'll probably get back to your description, Dev.
[00:07:38] Sure, yeah. So the idea of Miami Jam is to kind of stray away from like a typical interview or panel style show where we just bring on a few speakers and ask them questions.
[00:07:54] Instead, this show, Miami Jam, which we are hosting is going to be a little more like a game show where instead of just straight up asking questions about their topics or their motivations. We are going to ask trivia style questions.
[00:08:11] These can be react related questions or anything about weird quirks and JavaScript or TypeScript or anything adjacent to React. These could be guessing what library is being used or this could be a question about some other speakers topic which the person that the
[00:08:29] Question is directed to has to answer and then we'll use these opportunities to kind of segue into more detail, more in-depth discussions on what their topics are. So we still have to get a lot of insight from these speakers about what their topic
[00:08:51] Is, what their motivation is behind giving the certain talk or what their experience has been like in the industry and what kind of things that they are worked on that's bringing them to React Miami to give this talk.
[00:09:07] It's just structured in a style that's more like a game show so that it's more fun and it's more interactive, it's more collaborative. We're trying to get the speakers to share experiences with each other as well and we're trying to get the audience
[00:09:23] Involved by the I'm sorry if my phone notification is interrupting me with that on silent. Yeah, so yeah that's the point trying to make a collaborative trying to make it engaging. We're also going to have some stuff for the audience so if you
[00:09:40] Are in the audience there in the show you will also get to engage with the speakers. You'll get to ask your questions but you might also get to engage in other ways for example if we ask a question or if you ask them
[00:09:53] A question you can decide how many points they get yet for answering that question. And if the question is about--.