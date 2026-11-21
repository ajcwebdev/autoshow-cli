---
title: "2023-03-15-jsjam-qwik-misko-hevery"
slug: "2023-03-15-jsjam-qwik-misko-hevery"
duration: "1:52:52"
channel: "Local"
url: "docs/benchmarks/stt/sources/2023-03-15-jsjam-qwik-misko-hevery.mp3"
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
[00:00:05] [speaker-0] Welcome.
[00:00:29] [speaker-0] All right.
[00:00:32] [speaker-0] Yeah.
[00:00:33] [speaker-1] Yo yo yo.
[00:00:35] [speaker-0] Missy,
[00:00:35] [speaker-0] what's up,
[00:00:36] [speaker-0] up there,
[00:00:37] [speaker-0] man?
[00:00:39] [speaker-0] Here we go.
[00:00:43] [speaker-0] Welcome everybody.
[00:00:45] [speaker-2] Oh,
[00:00:45] [speaker-2] how's it going?
[00:00:46] [speaker-0] Welcome to
[00:00:48] [speaker-0] JavaScript Jam
[00:00:50] [speaker-0] Live.
[00:00:52] [speaker-0] We do this every Wednesday at twelve PM Pacific Standard Time.
[00:00:59] [speaker-0] Yes.
[00:01:00] [speaker-0] Oh yeah.
[00:01:02] [speaker-0] And we have a lot of fun doing it.
[00:01:04] [speaker-0] We have some great people join us.
[00:01:07] [speaker-0] Ragulas,
[00:01:11] [speaker-3] there's Jen.
[00:01:11] [speaker-3] She's one of them.
[00:01:13] [speaker-3] She's in here quite often.
[00:01:15] [speaker-3] But yeah,
[00:01:16] [speaker-3] I just wanted to thank everybody for coming today.
[00:01:18] [speaker-3] I just wanted to say,
[00:01:20] [speaker-3] whether you're a beginner or whether you're an advanced learner,
[00:01:26] [speaker-3] because what are we?
[00:01:27] [speaker-3] We we are as as engineers,
[00:01:30] [speaker-0] as developers.
[00:01:32] [speaker-0] We are lifelong learners,
[00:01:34] [speaker-0] right?
[00:01:34] [speaker-0] So whether...
[00:01:41] [speaker-3] oop,
[00:01:41] [speaker-3] there we go.
[00:01:42] [speaker-3] It went away.
[00:01:43] [speaker-3] All right.
[00:01:43] [speaker-3] Sorry,
[00:01:43] [speaker-3] I was getting a phone call.
[00:01:45] [speaker-3] Need to put this thing on focus mode,
[00:01:47] [speaker-3] y'all.
[00:01:47] [speaker-3] Come on.
[00:01:48] [speaker-3] Think I'm new to the game.
[00:01:50] [speaker-3] Told you,
[00:01:50] [speaker-3] lifelong learner,
[00:01:51] [speaker-3] right?
[00:01:53] [speaker-3] Lifelong learners.
[00:01:55] [speaker-3] That's where we are.
[00:01:55] [speaker-3] And so,
[00:01:57] [speaker-3] whether you're a beginner learner or an advanced learner.
[00:01:59] [speaker-3] We just want to say thank you all for coming,
[00:02:01] [speaker-3] and it doesn't matter who you are.
[00:02:02] [speaker-3] Come join us up here on the stage.
[00:02:04] [speaker-3] Just feel free to ask any questions you want,
[00:02:08] [speaker-3] state any facts,
[00:02:09] [speaker-3] opinions,
[00:02:10] [speaker-3] whatever.
[00:02:10] [speaker-3] We'd love to hear it.
[00:02:12] [speaker-3] All you gotta do is request to come up,
[00:02:13] [speaker-3] and we'd be more than happy to have you on.
[00:02:15] [speaker-3] But we do have today a special guest,
[00:02:20] [speaker-3] and we're going to be discussing,
[00:02:21] [speaker-3] I'm sure,
[00:02:21] [speaker-3] as you saw from the title there,
[00:02:23] [speaker-3] a little bit about
[00:02:25] [speaker-3] Quick. So kind of excited about this one.
[00:02:28] [speaker-3] Anthony,
[00:02:29] [speaker-3] I'm going to go ahead and make an introduction of myself real quick,
[00:02:31] [speaker-3] and then you can introduce yourself,
[00:02:33] [speaker-3] and then Misko,
[00:02:34] [speaker-3] you can go from there,
[00:02:34] [speaker-3] and and we'll we'll get started.
[00:02:36] [speaker-3] I'm I'm excited.
[00:02:38] [speaker-3] So my name is Scott Steinlogi,
[00:02:39] [speaker-3] and I am the technical community manager for Edgeo,
[00:02:43] [speaker-3] and co-host of
[00:02:44] [speaker-3] JavaScript Jam.
[00:02:45] [speaker-1] Hello,
[00:02:48] [speaker-1] my name is Anthony Campolo.
[00:02:50] [speaker-1] I am a developer advocate at Edgeo,
[00:02:52] [speaker-1] and we are super happy to have Misko here with us.
[00:02:58] [speaker-2] I guess it's my turn.
[00:02:59] [speaker-2] Hi,
[00:02:59] [speaker-2] I'm Mishko.
[00:03:00] [speaker-2] I am a CTO at Builder.io,
[00:03:03] [speaker-2] and yeah,
[00:03:04] [speaker-2] I'm so happy to be here.
[00:03:05] [speaker-2] So happy to chat with everybody.
[00:03:06] [speaker-2] Hi,
[00:03:06] [speaker-2] Jen.
[00:03:07] [speaker-2] I've been on your show before.
[00:03:09] [speaker-2] Yeah,
[00:03:09] [speaker-2] so let's talk about things related to quick and web and things of that sort.
[00:03:15] [speaker-1] Yeah,
[00:03:15] [speaker-1] I want to give you a shout out for being on Jen's show because Jen is a wasn't you know kind of still was getting into the industry and you went on and taught her how to write a counter.
[00:03:27] [speaker-1] Which was for someone of your stature is kind of funny,
[00:03:31] [speaker-1] but also shows that you're very humble and willing to you know work with beginners.
[00:03:36] [speaker-1] I think is really speaks a lot to your character.
[00:03:40] [speaker-2] I am new to this as well,
[00:03:41] [speaker-2] and so I'm happy to be on Jen's show.
[00:03:46] [speaker-1] Cool.
[00:03:47] [speaker-1] Well,
[00:03:47] [speaker-1] yeah,
[00:03:47] [speaker-1] we're gonna be talking about quick today,
[00:03:50] [speaker-1] and any other things you want to chat about with builder.
[00:03:54] [speaker-1] I've been kind of looking at the.
[00:03:56] [speaker-1] Builder.io blog posts and some of the topics that you had recently been looking at that I thought might be interesting to get into,
[00:04:05] [speaker-1] but before we have start checking those out,
[00:04:08] [speaker-1] we should start with a little bit of your background and the quick one oh one.
[00:04:14] [speaker-2] Yeah,
[00:04:15] [speaker-2] sure.
[00:04:15] [speaker-2] We're happy to jump into that background.
[00:04:17] [speaker-2] Let Let's see.
[00:04:19] [speaker-2] I actually,
[00:04:21] [speaker-2] I actually have a degree in computer engineering,
[00:04:23] [speaker-2] which is kind of weird because,
[00:04:25] [speaker-2] like.
[00:04:26] [speaker-2] The thing that I,
[00:04:27] [speaker-2] you know,
[00:04:28] [speaker-2] got my degree in is like how transistors work,
[00:04:31] [speaker-2] you know,
[00:04:31] [speaker-2] like all the way low level,
[00:04:33] [speaker-2] like CPUs work,
[00:04:34] [speaker-2] and you know the lowest possible level you can imagine.
[00:04:37] [speaker-2] And somehow over the years,
[00:04:38] [speaker-2] I have slowly transitioned to higher and higher level,
[00:04:42] [speaker-2] and you know,
[00:04:43] [speaker-2] because you know computers are just a bunch of abstractions,
[00:04:45] [speaker-2] right,
[00:04:45] [speaker-2] all the way to the to the top.
[00:04:47] [speaker-2] And so somehow I ended up in in the web,
[00:04:49] [speaker-2] which is pretty high abstraction,
[00:04:51] [speaker-2] right.
[00:04:52] [speaker-2] And normally,
[00:04:53] [speaker-2] when you like type a plus b or something like that inside of your web browser,
[00:04:56] [speaker-2] you don't really think about what all the insanity happens underneath to add two numbers together.
[00:05:02] [speaker-2] So yeah,
[00:05:02] [speaker-2] I have kind of a strange background.
[00:05:04] [speaker-2] I actually kind of like it because I kind of joke that I'm probably the only JavaScript engineer that knows how transistors work.
[00:05:09] [speaker-2] I'm sure there's plenty of others,
[00:05:10] [speaker-2] but it's not a common thing.
[00:05:13] [speaker-2] In in the hey,
[00:05:14] [speaker-3] I I love working on some things.
[00:05:16] [speaker-3] I have personally soldered some commercial.
[00:05:21] [speaker-3] Some custom boards together with capacitors,
[00:05:24] [speaker-3] resistors,
[00:05:24] [speaker-3] chips.
[00:05:25] [speaker-3] Yeah,
[00:05:26] [speaker-3] there you go.
[00:05:27] [speaker-3] Interesting thing.
[00:05:28] [speaker-3] So there you go.
[00:05:30] [speaker-2] I used to have a big poster of a chip I laid out over my bed,
[00:05:36] [speaker-2] but my girlfriend,
[00:05:37] [speaker-2] now my wife,
[00:05:38] [speaker-2] she decided that that didn't really fit the bedroom,
[00:05:41] [speaker-2] so it's no longer there.
[00:05:45] [speaker-0] Nice.
[00:05:46] [speaker-2] But anyway,
[00:05:46] [speaker-2] so so somehow I ended up in web technologies.
[00:05:50] [speaker-2] And I actually went to work at Adobe,
[00:05:53] [speaker-2] and there I learned Flex and Flash.
[00:05:56] [speaker-2] And then I ended up at Google,
[00:05:57] [speaker-2] and you know I kind of learned that like building web apps is just like a big marshaling problem of how do you get your data from the UI to the database and back to the from the database back to the UI.
[00:06:09] [speaker-2] And so this is where I kind of worked a little bit on Angular and Angular JS and Angular,
[00:06:13] [speaker-2] and I've done that for a pretty long time.
[00:06:16] [speaker-2] And then like two years ago or three years ago,
[00:06:18] [speaker-2] something like that.
[00:06:19] [speaker-2] I was just like,
[00:06:20] [speaker-2] I just need to try something new,
[00:06:21] [speaker-2] something different,
[00:06:22] [speaker-2] you know.
[00:06:22] [speaker-2] Either that,
[00:06:23] [speaker-2] or I'm going to become institutionalized.
[00:06:24] [speaker-2] And so,
[00:06:25] [speaker-2] I kind of went out and looked for a bunch of other things.
[00:06:29] [speaker-2] I ended up at Builder.io.
[00:06:30] [speaker-2] They what really spoke to me is this idea of no code editor.
[00:06:34] [speaker-2] What Builder.io does is basically,
[00:06:36] [speaker-2] I'm sure you guys are familiar with Wix.
[00:06:38] [speaker-2] Wix allows you to kind of drag and drop editor for building websites,
[00:06:41] [speaker-2] right?
[00:06:42] [speaker-2] But Wix forces all of that to be,
[00:06:45] [speaker-2] you know,
[00:06:45] [speaker-2] you have to host it with Wix.
[00:06:47] [speaker-2] You cannot take the site and like
[00:06:49] [speaker-2] Put it in a custom application or something like that,
[00:06:52] [speaker-2] and so with Builder.io is kind of the same exact idea as Wix,
[00:06:54] [speaker-2] except that you can actually embed it into your custom React,
[00:06:58] [speaker-2] Angular,
[00:06:59] [speaker-2] Vue,
[00:06:59] [speaker-2] Salt,
[00:06:59] [speaker-2] you know,
[00:07:00] [speaker-2] Quick application,
[00:07:02] [speaker-2] and I think that's kind of what's what's kind of unique and interesting.
[00:07:06] [speaker-2] Anyway,
[00:07:06] [speaker-2] so while at Builder,
[00:07:08] [speaker-2] I
[00:07:09] [speaker-2] I came to you know to my old habits,
[00:07:13] [speaker-2] so to speak,
[00:07:14] [speaker-2] and I was just like,
[00:07:15] [speaker-2] we need to make the web faster.
[00:07:18] [speaker-2] You know what's going on is just craziness.
[00:07:20] [speaker-2] It's too slow,
[00:07:21] [speaker-2] and you know the big kind of realization is like,
[00:07:24] [speaker-2] well,
[00:07:25] [speaker-2] it's it's relatively simple in the sense that like the performance or the startup performance of the site is just proportional to how much JavaScript the website has to execute at the beginning,
[00:07:36] [speaker-2] right?
[00:07:36] [speaker-2] And so,
[00:07:37] [speaker-2] if you decrease the amount of JavaScript you execute,
[00:07:38] [speaker-2] then your site obviously starts up faster.
[00:07:41] [speaker-2] And so,
[00:07:41] [speaker-2] quick kind of became this journey on how do you not ship so much JavaScript.
[00:07:47] [speaker-2] To the browser,
[00:07:48] [speaker-2] and so that's where we are today.
[00:07:52] [speaker-1] Nice,
[00:07:53] [speaker-1] yeah.
[00:07:53] [speaker-1] I find that this is very much in the zeitgeist right now with
[00:07:58] [speaker-1] JavaScripts. A lot of people are concerned with performance,
[00:08:01] [speaker-1] both in the framework world and outside the framework world.
[00:08:05] [speaker-1] I think it's interesting.
[00:08:05] [speaker-1] You look at you know someone like Alex Russell.
[00:08:08] [speaker-1] He's really giving a similar message to you,
[00:08:11] [speaker-1] but he is saying less so that you know we should.
[00:08:16] [speaker-1] Have a performant framework so much as we shouldn't have a framework at all,
[00:08:20] [speaker-1] or you should you know kind of build your own bespoke one for the needs of your specific project.
[00:08:26] [speaker-1] So why do you feel that we should architect these frameworks to be performant instead of just using like native web components?
[00:08:36] [speaker-2] I think a lot of people are coming coming to the same exact conclusion,
[00:08:39] [speaker-2] and the conclusion is that there is too much JavaScript.
[00:08:42] [speaker-2] Right,
[00:08:43] [speaker-2] it's kind of a
[00:08:45] [speaker-2] Like obvious conclusion,
[00:08:46] [speaker-2] but it's also a conclusion that is kind of difficult to be actionable.
[00:08:50] [speaker-2] You know,
[00:08:51] [speaker-2] I always kind of joke that when you go to
[00:08:54] [speaker-2] Google Lighthouse score,
[00:08:55] [speaker-2] right,
[00:08:56] [speaker-2] it tells you decrease the amount of JavaScript.
[00:08:58] [speaker-2] And it's like,
[00:08:58] [speaker-2] yes,
[00:08:58] [speaker-2] yes,
[00:08:59] [speaker-2] I understand that,
[00:08:59] [speaker-2] but like how?
[00:09:01] [speaker-2] Like,
[00:09:01] [speaker-2] what's the magic button that I can push to get less JavaScript?
[00:09:04] [speaker-2] Right?
[00:09:05] [speaker-2] It's it's kind of like you know,
[00:09:08] [speaker-2] you go to somebody and they say,
[00:09:09] [speaker-2] well,
[00:09:09] [speaker-2] you know,
[00:09:09] [speaker-2] I decided that your problem is that you're poor,
[00:09:11] [speaker-2] so you just have to make more money.
[00:09:12] [speaker-2] It's like,
[00:09:13] [speaker-2] yeah,
[00:09:13] [speaker-2] I get it.
[00:09:13] [speaker-2] But like,
[00:09:14] [speaker-2] how?
[00:09:15] [speaker-2] Like,
[00:09:15] [speaker-2] what's the magical thing to do here?
[00:09:18] [speaker-2] And so,
[00:09:20] [speaker-2] I think what Alex a lot of times talks about is this idea of like,
[00:09:23] [speaker-2] let's just be more frugal about things.
[00:09:26] [speaker-2] And
[00:09:27] [speaker-2] I think being frugal is kind of difficult.
[00:09:29] [speaker-2] Like,
[00:09:30] [speaker-2] yeah,
[00:09:30] [speaker-2] I get it.
[00:09:31] [speaker-2] Like,
[00:09:31] [speaker-2] you could be more frugal and be more careful,
[00:09:33] [speaker-2] et cetera.
[00:09:34] [speaker-2] But at the end of the day,
[00:09:34] [speaker-2] you know,
[00:09:35] [speaker-2] we have things to deliver,
[00:09:36] [speaker-2] we have other distractions,
[00:09:38] [speaker-2] et cetera,
[00:09:38] [speaker-2] and so we just want the tools to solve this for us.
[00:09:41] [speaker-2] And so my take on the whole thing is that our tools should be helping us,
[00:09:46] [speaker-2] and I think we're kind of in the world where the tools are somewhere between not helping and actually actively trying to sabotage us.
[00:09:55] [speaker-2] It's not intentional.
[00:09:57] [speaker-2] It's not like we intentionally designed these tools this particular way,
[00:10:00] [speaker-2] but we kind of ended up in this world because we didn't really understand the the web ecosystem or the web world,
[00:10:08] [speaker-2] and we came to the web world from.
[00:10:11] [speaker-2] Kind of the desktop application world,
[00:10:12] [speaker-2] right?
[00:10:13] [speaker-2] Like a desktop application world,
[00:10:14] [speaker-2] like the concept of lazy loading is just not much of a thing,
[00:10:17] [speaker-2] and so you don't really design your framework to kind of take this into account.
[00:10:22] [speaker-2] And if you look at most lazy loaded frameworks today,
[00:10:24] [speaker-2] like most frameworks today that they have lazy loading,
[00:10:28] [speaker-2] it's true they have that,
[00:10:29] [speaker-2] but it's a kind of a,
[00:10:31] [speaker-2] I would say,
[00:10:31] [speaker-2] an afterthought.
[00:10:32] [speaker-2] It's not the lazy loading was never inside of version one of any of these frameworks.
[00:10:37] [speaker-2] Lazy loading was something that was added later on,
[00:10:39] [speaker-2] and because it was added later on,
[00:10:41] [speaker-2] it's it's it's not like the core primitive of what these things do,
[00:10:46] [speaker-2] and so there's like all kinds of you know I would say clever ways of of lazy load the code,
[00:10:52] [speaker-2] but but but all of them essentially have this particular problem,
[00:10:56] [speaker-2] and that is that you can only lazy load code that is currently not needed,
[00:11:02] [speaker-2] which seems kind of obvious,
[00:11:03] [speaker-2] but like what it means in in in practice is that if you have a component.
[00:11:07] [speaker-2] That is currently on your page.
[00:11:09] [speaker-2] You have to lazy load the code for the component,
[00:11:11] [speaker-2] even though that component might not be doing anything,
[00:11:14] [speaker-2] might not have any behavior,
[00:11:15] [speaker-2] or it might already be rendered and it never needs to be rendered again.
[00:11:19] [speaker-2] But just the way the existing tools work and the way hydration works,
[00:11:23] [speaker-2] that code has to be present in the client.
[00:11:26] [speaker-2] And so,
[00:11:28] [speaker-2] you know,
[00:11:29] [speaker-2] the the mental exercise that Quickest tries to do is to say,
[00:11:32] [speaker-2] like,
[00:11:32] [speaker-2] how do we delay the code as much as possible?
[00:11:36] [speaker-2] Right,
[00:11:36] [speaker-2] and just take it to an extreme,
[00:11:38] [speaker-2] and have the tools just do it automatically.
[00:11:41] [speaker-2] So,
[00:11:41] [speaker-2] as a developer,
[00:11:41] [speaker-2] you just don't have to think about it.
[00:11:46] [speaker-1] Awesome!
[00:11:46] [speaker-1] I want to give a shout out to Raiz who just joined us.
[00:11:50] [speaker-1] You want to introduce yourself?
[00:11:52] [speaker-4] Hey,
[00:11:54] [speaker-4] yeah,
[00:11:54] [speaker-4] sorry.
[00:11:55] [speaker-4] My name is Raiz.
[00:11:56] [speaker-4] I am the product manager for Edgeu Sites.
[00:11:59] [speaker-4] I work at Edgeu with with Anthony and Scott and some other people here.
[00:12:05] [speaker-4] Yeah,
[00:12:07] [speaker-4] just just listening in and and being inspired.
[00:12:12] [speaker-4] I have a couple of questions that I'll I'll save for later though.
[00:12:16] [speaker-1] Yeah,
[00:12:16] [speaker-1] I actually um I told Rayes he should definitely make it for this one because he's someone who actually has worked um quite deeply with Quick and has um kind of scoped it out for some production apps.
[00:12:28] [speaker-1] So I was like,
[00:12:28] [speaker-1] you should definitely hop up here and.
[00:12:30] [speaker-1] Ask some questions when you have it.
[00:12:32] [speaker-1] Yeah,
[00:12:32] [speaker-1] feel free to jump in at any point.
[00:12:34] [speaker-1] We're just doing kind of like the quick one-on-one right now,
[00:12:37] [speaker-1] and then we'll get into some deeper questions as we go.
[00:12:40] [speaker-1] So we talked about quick.
[00:12:41] [speaker-1] We talked about kind of the problem it's meant to solve,
[00:12:46] [speaker-1] and it seems like it's aiming for a similar thing to,
[00:12:49] [speaker-1] uh,
[00:12:50] [speaker-1] like partial hydration.
[00:12:52] [speaker-1] How do we manage the amount of JavaScript we have?
[00:12:55] [speaker-1] Same thing with server components.
[00:12:56] [speaker-1] So it's a lot of different.
[00:12:58] [speaker-1] Ways that we're trying to approach this problem,
[00:13:01] [speaker-1] and then there's also Quick City as well.
[00:13:04] [speaker-1] So you should talk a little bit about how Quick City fits in here.
[00:13:08] [speaker-2] Yeah,
[00:13:08] [speaker-2] we can talk about that.
[00:13:09] [speaker-2] But first,
[00:13:10] [speaker-2] sorry,
[00:13:11] [speaker-2] I'm going to be a little bit of a stickler,
[00:13:12] [speaker-2] and
[00:13:13] [speaker-2] I will try to very politely correct something here.
[00:13:16] [speaker-2] You just said you said partial hydration.
[00:13:20] [speaker-2] Well,
[00:13:20] [speaker-1] I know it's not partial hydration.
[00:13:21] [speaker-1] I'm saying they're both the thing you're doing and the thing partial hydration are doing are trying to solve the same problem.
[00:13:27] [speaker-1] But I know they're doing it differently,
[00:13:28] [speaker-1] so you can go and go into that.
[00:13:30] [speaker-1] Yes,
[00:13:30] [speaker-2] no,
[00:13:30] [speaker-2] no,
[00:13:30] [speaker-2] no,
[00:13:30] [speaker-2] absolutely,
[00:13:31] [speaker-2] yeah.
[00:13:31] [speaker-2] No,
[00:13:31] [speaker-2] it's a.
[00:13:31] [speaker-2] I just wanted to make it clear,
[00:13:32] [speaker-2] like it's a different.
[00:13:33] [speaker-2] It's a.
[00:13:34] [speaker-2] It solves the same problem,
[00:13:35] [speaker-2] right?
[00:13:35] [speaker-2] The problem you're trying to solve is way too much JavaScript is being executed on initial page navigation,
[00:13:41] [speaker-2] right?
[00:13:42] [speaker-2] That that's the fundamental of the problem you're trying to solve.
[00:13:44] [speaker-2] And there's a lot of different approaches you could take.
[00:13:48] [speaker-2] And you know,
[00:13:49] [speaker-2] Quick was basically designed from ground up to delay execute the code extremely aggressively as much as possible.
[00:13:56] [speaker-2] And that's kind of its trick,
[00:13:58] [speaker-2] right?
[00:13:58] [speaker-2] That's the thing that it's trying to do.
[00:14:00] [speaker-2] And the argument here is that if you can do that,
[00:14:03] [speaker-2] then you can greatly lower the amount of JavaScript.
[00:14:06] [speaker-2] So,
[00:14:07] [speaker-2] anyways,
[00:14:09] [speaker-2] so QuickCity,
[00:14:09] [speaker-2] yeah.
[00:14:09] [speaker-2] Let's talk about QuickCity.
[00:14:11] [speaker-2] So,
[00:14:11] [speaker-2] you know,
[00:14:12] [speaker-2] we built Quick,
[00:14:13] [speaker-2] and we originally didn't want to go into the business of building a meta framework.
[00:14:17] [speaker-2] We were kind of hoping that we could either reuse Next.js or Remix or you know one of the existing meta frameworks that are currently out there.
[00:14:25] [speaker-2] But turns out like there's a lot of details that matter,
[00:14:30] [speaker-2] and so whether we liked it or not,
[00:14:32] [speaker-2] we ended up building a meta framework that can take advantage of Quick.
[00:14:38] [speaker-2] And the one way to kind of think about it is,
[00:14:41] [speaker-2] you know,
[00:14:41] [speaker-2] Quick City is kind of like Next.js to React,
[00:14:44] [speaker-2] right?
[00:14:44] [speaker-2] So Quick City is to Quick in the same way.
[00:14:47] [speaker-2] But it solves it takes the problem in a slightly different way.
[00:14:52] [speaker-2] What's unique about Quick City and Quick is that the frameworks that
[00:14:56] [speaker-2] Or we can really think about together.
[00:14:57] [speaker-2] It's just quick.
[00:14:58] [speaker-2] What's unique about it is that they really want to solve the whole problem end to end.
[00:15:01] [speaker-2] What I mean by whole problem end to end is how do you make the bundles?
[00:15:05] [speaker-2] How do you break up your code?
[00:15:07] [speaker-2] How do you lazy load the code?
[00:15:09] [speaker-2] How do you make sure that the lazy loading is pre cached so that you don't have you know hiccups on a slow network or intermittent network?
[00:15:18] [speaker-2] How do you serialize the data?
[00:15:19] [speaker-2] How do you deserialize the data on the other side?
[00:15:20] [speaker-2] How do you wake up the application?
[00:15:23] [speaker-2] Basically,
[00:15:23] [speaker-2] all of those.
[00:15:24] [speaker-2] Pieces that are related are solved as a cohesive problem set.
[00:15:29] [speaker-2] Whereas,
[00:15:30] [speaker-2] if you look at the existing systems,
[00:15:32] [speaker-2] you know they they solve the the parts in pieces,
[00:15:35] [speaker-2] or maybe they don't.
[00:15:36] [speaker-2] So,
[00:15:36] [speaker-2] for example,
[00:15:38] [speaker-2] you know Next.js doesn't really it relies on existing technologies to create bundles.
[00:15:43] [speaker-2] But it but because it's relies on existing technologies,
[00:15:46] [speaker-2] it means that as a developer,
[00:15:48] [speaker-2] if you want to have a lazy loaded boundary,
[00:15:49] [speaker-2] you have to think about it.
[00:15:50] [speaker-2] You have to put a dynamic import somewhere in your code base.
[00:15:53] [speaker-2] And if you don't put that in,
[00:15:55] [speaker-2] well,
[00:15:55] [speaker-2] then you know that particular bit can't be lazy loaded.
[00:15:58] [speaker-2] Whereas with Quick,
[00:15:59] [speaker-2] you know you don't have to think about it; it's just automatic and and natural.
[00:16:03] [speaker-2] So,
[00:16:03] [speaker-2] so the the problem we're trying to solve is that we would like to have a environment where the whole part of like serving a web application in the fastest possible way is something that is available to you,
[00:16:16] [speaker-2] solved out of the box.
[00:16:17] [speaker-2] You don't have to think about it as an afterthought.
[00:16:22] [speaker-1] Awesome.
[00:16:23] [speaker-1] Welcome to the stage,
[00:16:24] [speaker-1] Daniel.
[00:16:25] [speaker-1] Did you have a question for Michio?
[00:16:31] [speaker-1] And if they're not here right now,
[00:16:33] [speaker-1] Raissa,
[00:16:33] [speaker-1] if you want to hop in with any of your questions,
[00:16:35] [speaker-1] feel free.
[00:16:36] [speaker-4] Yeah.
[00:16:36] [speaker-4] So actually,
[00:16:38] [speaker-4] as as N three mentioned,
[00:16:39] [speaker-4] I actually built a production website,
[00:16:43] [speaker-4] a small production website with Quick.
[00:16:46] [speaker-4] And while while we were actually building that,
[00:16:50] [speaker-4] some of the APIs changed and.
[00:16:53] [speaker-4] I was trying to basically see the documentation in GitHub and see what what is going on with the APIs,
[00:17:01] [speaker-4] and I found out that you guys are working on the server,
[00:17:05] [speaker-4] you know,
[00:17:06] [speaker-4] server closure.
[00:17:07] [speaker-4] I think it's called or or something.
[00:17:10] [speaker-4] I would love to you know get to know what was the motivation behind that.
[00:17:14] [speaker-4] It seems seems like it should have been done by other people as well.
[00:17:21] [speaker-4] You know,
[00:17:22] [speaker-4] are other people other frameworks doing it as well,
[00:17:25] [speaker-4] or is
[00:17:26] [speaker-4] Quick City the first one to do this?
[00:17:29] [speaker-4] And what was the you know what was the inspiration for that?
[00:17:33] [speaker-2] Yes,
[00:17:33] [speaker-2] I believe you're talking about server dollar sign,
[00:17:35] [speaker-2] right?
[00:17:35] [speaker-4] Yeah,
[00:17:36] [speaker-4] yeah.
[00:17:36] [speaker-2] Okay,
[00:17:37] [speaker-2] um,
[00:17:38] [speaker-2] yeah.
[00:17:38] [speaker-2] So I think there is a general trend towards what I call code collocation.
[00:17:43] [speaker-2] This idea that as a developer,
[00:17:45] [speaker-2] you know,
[00:17:45] [speaker-2] we have some code that runs on a server and some code that runs on the client.
[00:17:50] [speaker-2] But we don't really want to think of it as two separate things.
[00:17:52] [speaker-2] We really want to just have a single codebase,
[00:17:54] [speaker-2] right?
[00:17:54] [speaker-2] So we want to collocate our server code together with our client code.
[00:17:58] [speaker-2] And if you look at it,
[00:17:59] [speaker-2] like existing frameworks already do this.
[00:18:00] [speaker-2] If you look at Next.js,
[00:18:01] [speaker-2] there's the getServerProps.
[00:18:04] [speaker-2] If you look at Remix,
[00:18:05] [speaker-2] I forget off the top of my head what they have,
[00:18:07] [speaker-2] but they have a similar mechanism by where you can fetch data.
[00:18:10] [speaker-2] And basically,
[00:18:10] [speaker-2] all meta frameworks have a mechanism by where you can essentially execute code that is
[00:18:17] [speaker-2] Server-only code,
[00:18:18] [speaker-2] meaning it talks to a database or a file system,
[00:18:20] [speaker-2] something that can never be on the client,
[00:18:23] [speaker-2] but have a way of making sure that when the bundles are created,
[00:18:27] [speaker-2] that code doesn't end up in the client,
[00:18:29] [speaker-2] right?
[00:18:29] [speaker-2] And so,
[00:18:30] [speaker-2] so this is a trend that I think already has existed for a while.
[00:18:34] [speaker-2] Nothing has changed in it,
[00:18:35] [speaker-2] and so
[00:18:36] [speaker-2] I think what we're looking for is just a more natural way of mixing server and the client code.
[00:18:42] [speaker-2] So once we get server server props,
[00:18:45] [speaker-2] you know,
[00:18:45] [speaker-2] once that can get started.
[00:18:47] [speaker-2] Other people have kind of tried to push this idea even further.
[00:18:50] [speaker-2] So,
[00:18:50] [speaker-2] like TRPC is another example.
[00:18:52] [speaker-2] Over like,
[00:18:53] [speaker-2] hey,
[00:18:53] [speaker-2] I have server code,
[00:18:54] [speaker-2] I have client code.
[00:18:55] [speaker-2] How do I make sure that the type information flows through it,
[00:18:58] [speaker-2] and so on?
[00:18:59] [speaker-2] Before something like TRPC,
[00:19:00] [speaker-2] like type information wouldn't flow between the server and the client.
[00:19:04] [speaker-2] And so,
[00:19:05] [speaker-2] if you just take this idea even further,
[00:19:07] [speaker-2] then you end up something with a server dollar sign,
[00:19:10] [speaker-2] where you can
[00:19:12] [speaker-2] You have a underlying system that knows how to break up your code in such a way so that you don't accidentally ship server server code to the client,
[00:19:21] [speaker-2] but it's written in such a way where the semantic meaning of what server side dollar is is is kind of left in the user space in the developer space.
[00:19:29] [speaker-2] Meaning that you know I could implement server dollar sign,
[00:19:32] [speaker-2] or I can implement worker dollar sign,
[00:19:34] [speaker-2] or I could implement you know anyone anyone of others of these you know load data on a server.
[00:19:41] [speaker-2] Dollar sign,
[00:19:41] [speaker-2] kind of a thing,
[00:19:43] [speaker-2] and so what Quick kind of
[00:19:45] [speaker-2] I think pioneered is kind of unique to Quick is this idea that you have a marker function that can take code and break it apart so that you as a developer can decide well what does it mean for these two parts to to do like do I execute the part in the same location or the
[00:20:02] [speaker-2] location on the other side,
[00:20:04] [speaker-2] etc.
[00:20:05] [speaker-2] So we call this idea code collocation and code extraction.
[00:20:09] [speaker-2] And so,
[00:20:10] [speaker-2] serverless on actually kind of fits an interesting niche where you know you want to just make a call on a server,
[00:20:17] [speaker-2] and so you want to have a simple way of doing it,
[00:20:20] [speaker-2] but you don't necessarily want to reach to something more heavyweight like TRPC.
[00:20:24] [speaker-2] Like TRPC has other advantages in that you can have kind of a different client,
[00:20:29] [speaker-2] sort of different teams working on the API side and different team working on the client side.
[00:20:35] [speaker-2] There's a backwards compatibility story in there,
[00:20:37] [speaker-2] saying that you have to make sure that you don't accidentally,
[00:20:39] [speaker-2] because there's a version skew between the the version that's in a in a browser versus the version that's on a server.
[00:20:44] [speaker-2] You want to change your APIs in such a way so they're compatible,
[00:20:47] [speaker-2] right?
[00:20:48] [speaker-2] So so TRPC allows you to do all of these fancy things,
[00:20:51] [speaker-2] but maybe sometimes you don't need it.
[00:20:53] [speaker-2] Sometimes you just want something quick and simple,
[00:20:55] [speaker-2] and you know to kind of get you moved on from it.
[00:20:58] [speaker-2] And so something like Server Dollar Sign is an interesting stopgap measure.
[00:21:02] [speaker-2] So what we're doing is we're making it easy.
[00:21:04] [speaker-2] For people to collocate server and the client code together in the saved file and making it easy for us to communicate between that,
[00:21:13] [speaker-2] and for we think for like ninety percent of the use cases is good enough,
[00:21:17] [speaker-2] and for the more complicated ten percent of the use cases,
[00:21:19] [speaker-2] well,
[00:21:20] [speaker-2] you know there are other tools out there that you can kind of hop in and use.
[00:21:26] [speaker-2] And I think
[00:21:26] [speaker-2] I see Theo is also over here,
[00:21:28] [speaker-2] and I know Theo has was pretty outspoken about TRPC and how and
[00:21:32] [speaker-2] So you could probably jump in and have some opinions as well.
[00:21:37] [speaker-1] Looks like Daniel's got his hand up.
[00:21:38] [speaker-1] You want to hop in?
[00:21:42] [speaker-5] Hello,
[00:21:42] [speaker-5] good evening.
[00:21:44] [speaker-5] Sorry,
[00:21:44] [speaker-5] good evening from Nigeria.
[00:21:46] [speaker-5] So
[00:21:47] [speaker-5] I have a question.
[00:21:48] [speaker-5] I write
[00:21:49] [speaker-5] Python and I use that for artificial intelligence.
[00:21:53] [speaker-5] But is it possible for someone to write
[00:21:56] [speaker-5] AI with
[00:21:57] [speaker-5] JavaScript? Is it really possible?
[00:21:59] [speaker-5] I know you can write it with C plus plus.
[00:22:01] [speaker-5] In Python,
[00:22:01] [speaker-5] but is it possible with JavaScript?
[00:22:05] [speaker-2] Ah,
[00:22:05] [speaker-2] this is not my area of expertise.
[00:22:07] [speaker-2] I can answer that,
[00:22:09] [speaker-2] but go,
[00:22:09] [speaker-2] go for it,
[00:22:09] [speaker-2] yeah.
[00:22:10] [speaker-1] Yeah,
[00:22:10] [speaker-1] so I mean,
[00:22:12] [speaker-1] so when you're talking about like AI,
[00:22:14] [speaker-1] there's different things you can kind of talk about here.
[00:22:17] [speaker-1] So there's actual training,
[00:22:19] [speaker-1] like models themselves,
[00:22:21] [speaker-1] which is typically done in Python,
[00:22:24] [speaker-1] but you can do some of this in JavaScript.
[00:22:26] [speaker-1] Like there's a JavaScript like TensorFlow library.
[00:22:29] [speaker-1] Or you can write JavaScript code that's gonna hit like an API,
[00:22:34] [speaker-1] like OpenAI's API,
[00:22:37] [speaker-1] and with that you can write JavaScript application that will be hitting essentially the
[00:22:42] [speaker-1] AI kind of services.
[00:22:44] [speaker-1] So for the most part,
[00:22:45] [speaker-1] that's what you'll be doing.
[00:22:46] [speaker-1] You won't really be coding so much direct AI stuff itself in JavaScript,
[00:22:51] [speaker-1] but you still work with AI tools in the language of JavaScript.
[00:22:55] [speaker-1] Does that make sense?
[00:22:58] [speaker-5] Yeah,
[00:22:58] [speaker-5] kind of,
[00:22:59] [speaker-5] but you know,
[00:23:00] [speaker-5] trying to do stuff like a convolutional neural network or a computer vision project,
[00:23:05] [speaker-5] you know,
[00:23:05] [speaker-5] I've been learning stuff like JavaScript,
[00:23:07] [speaker-5] and I have full interest with um with AI.
[00:23:11] [speaker-5] I've been working with AI for quite a long time,
[00:23:12] [speaker-5] just with Python.
[00:23:13] [speaker-5] So
[00:23:15] [speaker-5] I don't just know.
[00:23:16] [speaker-5] I think I know of the
[00:23:18] [speaker-5] Java TensorFlow JS,
[00:23:20] [speaker-5] but I don't know if it can do everything Python can actually do.
[00:23:23] [speaker-5] Just sounds weird.
[00:23:25] [speaker-5] I don't know.
[00:23:28] [speaker-1] Yeah,
[00:23:29] [speaker-1] yeah.
[00:23:29] [speaker-1] I mean,
[00:23:29] [speaker-1] we're not really AI experts up here,
[00:23:32] [speaker-1] unfortunately.
[00:23:33] [speaker-1] So I think that's probably about all the the words of wisdom we can give you.
[00:23:37] [speaker-1] It's like um,
[00:23:38] [speaker-1] Theo got your hand up,
[00:23:41] [speaker-6] Eddie.
[00:23:41] [speaker-6] I wanted to chat a bit about the TRPC stuff just because I,
[00:23:45] [speaker-6] I agree with parts,
[00:23:46] [speaker-6] but not necessarily the whole.
[00:23:48] [speaker-6] I think the the framing that I've grown to take on is like,
[00:23:52] [speaker-6] what's the distance between your backend and your front end in a developer experience,
[00:23:57] [speaker-6] or
[00:23:58] [speaker-6] Way,
[00:23:59] [speaker-6] where like colocation is obviously a huge like win in that the backend code that your frontend uses is right there,
[00:24:06] [speaker-6] and when you use a primitive like server dollar sign to like generate those functions,
[00:24:10] [speaker-6] you end up with a lot of the like type safe behavior that you would expect from just writing calling functions in TypeScript traditionally.
[00:24:18] [speaker-6] I find that when we look at stuff like REST and GraphQL.
[00:24:21] [speaker-6] There is an abstraction there that makes the distance between the backend and frontend code feel much greater,
[00:24:27] [speaker-6] and you have a much more mental overhead to work with when you're making those types of changes in between that relationship.
[00:24:34] [speaker-6] The benefit of that cost is that you now have a backend that can be used for multiple purposes across multiple clients,
[00:24:40] [speaker-6] and the split actually makes the team split better too.
[00:24:43] [speaker-6] One of the points Mr.
[00:24:43] [speaker-6] Co made that I don't necessarily agree with is that TRPC helps like the backend and frontend teams be separate.
[00:24:49] [speaker-6] I actually think it's uniquely poor.
[00:24:51] [speaker-6] In that,
[00:24:51] [speaker-6] in that,
[00:24:52] [speaker-6] like TRPC is a first-class backend for front-end.
[00:24:56] [speaker-6] What we're describing here with server dollar sign is a first-class backend primitive in your front-end,
[00:25:02] [speaker-6] and I think the distance between those two things is not very great.
[00:25:06] [speaker-6] Like I would consider TRPC closer to a server dollar sign type thing than I would to GraphQL,
[00:25:11] [speaker-6] simply because command-click go to definition works as expected,
[00:25:16] [speaker-6] and I think the the magic of TRPC isn't that it's
[00:25:19] [speaker-6] More like GraphQL or more like like an RPC.
[00:25:22] [speaker-6] It's that it it represents this unique in between where you get a lot of the DX wins from both and the ability to use your server across multiple platforms and clients.
[00:25:33] [speaker-2] I just want to add something.
[00:25:35] [speaker-2] I agree with everything you said.
[00:25:37] [speaker-2] Do you think would be a good characterization that you kind of have layers,
[00:25:41] [speaker-2] right?
[00:25:41] [speaker-2] Like server dollar is by far the closest in the distance,
[00:25:44] [speaker-2] and then TRPC is a little further away,
[00:25:46] [speaker-2] but like still,
[00:25:47] [speaker-2] you know,
[00:25:47] [speaker-2] we're pretty close.
[00:25:48] [speaker-2] And then GraphQL would be like kind of the furthest up there,
[00:25:51] [speaker-2] right?
[00:25:53] [speaker-6] Exactly.
[00:25:54] [speaker-6] This is the framing I've been trying to take on more,
[00:25:56] [speaker-6] and while doing it,
[00:25:57] [speaker-6] show the benefits that you get as you leave like further out the circle.
[00:26:01] [speaker-1] Yeah,
[00:26:01] [speaker-1] it's a trade-off,
[00:26:02] [speaker-1] definitely.
[00:26:06] [speaker-1] Awesome.
[00:26:06] [speaker-1] Looks like we got real.
[00:26:07] [speaker-1] Double O Seven has their hand up.
[00:26:09] [speaker-1] This is a first-time caller.
[00:26:14] [speaker-7] Hello.
[00:26:14] [speaker-1] Hey.
[00:26:17] [speaker-7] Hey guys.
[00:26:18] [speaker-7] My name is Tino,
[00:26:19] [speaker-7] and I have a tricky question for Mishkobadz.
[00:26:23] [speaker-7] I don't know if he can answer.
[00:26:25] [speaker-7] So my question is:
[00:26:27] [speaker-7] as far as I know,
[00:26:28] [speaker-7] Quick and Quick City are still in beta.
[00:26:31] [speaker-7] What are they waiting for in order to reach version 1.0?
[00:26:36] [speaker-7] What is that one thing that they are waiting for?
[00:26:39] [speaker-7] I don't know if Mishko can answer this or not.
[00:26:41] [speaker-7] Yeah,
[00:26:42] [speaker-2] I can definitely try.
[00:26:44] [speaker-2] I think what we're missing mainly is documentation.
[00:26:48] [speaker-2] And kind of polish.
[00:26:49] [speaker-2] You know what we want is we want people to have a good experience,
[00:26:52] [speaker-2] right?
[00:26:52] [speaker-2] So if you come in and you type in quick create project and you know do basic operations,
[00:26:58] [speaker-2] it should all kind of work.
[00:27:00] [speaker-2] And right now we're still getting lots of feedback from the community of like kind of sharp edges.
[00:27:05] [speaker-2] We're like things work,
[00:27:07] [speaker-2] but like you got to be watch out for this and that,
[00:27:09] [speaker-2] etc.
[00:27:09] [speaker-2] And so from our point of view,
[00:27:11] [speaker-2] it is not a high enough standard that we have reached.
[00:27:14] [speaker-2] But we would like to get to version 1.0 pretty pretty soon.
[00:27:18] [speaker-2] Of course,
[00:27:18] [speaker-2] with like anything related to versioning and guesses about the future,
[00:27:22] [speaker-2] you're always wrong about it,
[00:27:23] [speaker-2] right?
[00:27:23] [speaker-2] So I'm not going to pick a specific date,
[00:27:25] [speaker-2] but I'm just going to think we're getting pretty close.
[00:27:29] [speaker-7] Okay.
[00:27:29] [speaker-7] Okay.
[00:27:29] [speaker-7] No,
[00:27:30] [speaker-7] thank you so much for your time.
[00:27:35] [speaker-1] Also,
[00:27:36] [speaker-1] hello to
[00:27:37] [speaker-1] Ellery. You got any questions for the space?
[00:27:42] [speaker-8] Ah,
[00:27:42] [speaker-8] no,
[00:27:42] [speaker-8] nothing yet.
[00:27:43] [speaker-8] But I will definitely raise my hand eventually.
[00:27:48] [speaker-1] Actually,
[00:27:48] [speaker-1] Jen's coming up.
[00:27:50] [speaker-4] Yes,
[00:27:51] [speaker-4] since since Elvii is here,
[00:27:53] [speaker-4] it reminds me one of our actually one of our largest clients at AGO is interested in.
[00:28:02] [speaker-4] They're very interested in trying out Quick and you know think about their websites.
[00:28:11] [speaker-4] Some of their websites are probably some of the largest e-commerce websites by revenue on the internet.
[00:28:18] [speaker-4] And one of the one of the problems that we're running into is the existing websites are built in multiple different kinds of kinds of frameworks,
[00:28:28] [speaker-4] or you can say backends.
[00:28:31] [speaker-4] One would be Next.js,
[00:28:33] [speaker-4] another is
[00:28:34] [speaker-4] Salesforce Commerce Cloud,
[00:28:35] [speaker-4] or something else.
[00:28:36] [speaker-4] And it's just the translating of all the work you've already done in Next.js and and React into Quick is like a huge.
[00:28:47] [speaker-4] Basically,
[00:28:48] [speaker-4] you have to rebuild everything,
[00:28:49] [speaker-4] and the the advantage you have with React is there's a huge amount of community work that's available that that you can use,
[00:28:59] [speaker-4] and that is not not available as much with Quick.
[00:29:05] [speaker-4] So,
[00:29:05] [speaker-4] you know,
[00:29:06] [speaker-4] in general,
[00:29:06] [speaker-4] I'm just asking,
[00:29:07] [speaker-4] like,
[00:29:08] [speaker-4] how are you seeing the the community work for Quick and Quick City?
[00:29:14] [speaker-4] And you know,
[00:29:15] [speaker-4] are are you seeing any like how how's the how's the trend graph going for the for you know open source components?
[00:29:25] [speaker-2] Yeah,
[00:29:25] [speaker-2] I mean,
[00:29:26] [speaker-2] Quick is pretty new,
[00:29:26] [speaker-2] so obviously our community is nowhere close in size to to React.
[00:29:31] [speaker-2] But I think Quick offers some pretty compelling value propositions in here,
[00:29:36] [speaker-2] right?
[00:29:36] [speaker-2] And so people who really want to make sure that their sites are fast and places like e-commerce is a perfect example for this.
[00:29:43] [speaker-2] I think might want to explore it now to help with these.
[00:29:46] [speaker-2] We do have Quick React,
[00:29:48] [speaker-2] which allows you to take existing React components and wrap them in Quick.
[00:29:52] [speaker-2] Obviously,
[00:29:52] [speaker-2] you're not going to get all the magical benefits out of the box.
[00:29:55] [speaker-2] There is basically Quick React is essentially creating island architecture.
[00:30:00] [speaker-2] You delay hydrating those particular components that are
[00:30:03] [speaker-2] Quick that are React components,
[00:30:06] [speaker-2] so it's not a reasonability,
[00:30:07] [speaker-2] but at least you can kind of work on it together.
[00:30:10] [speaker-2] When I talk about kind of
[00:30:12] [speaker-2] Advantages and disadvantages of different technologies.
[00:30:14] [speaker-2] I like to talk about things like intrinsic and extrinsic factors.
[00:30:18] [speaker-2] And so,
[00:30:19] [speaker-2] to me,
[00:30:19] [speaker-2] like the fact that
[00:30:22] [speaker-2] Quick's community and Quick's documentation and the know-how,
[00:30:24] [speaker-2] etc.,
[00:30:25] [speaker-2] are obviously not as high as somebody who's been around for much,
[00:30:29] [speaker-2] much longer.
[00:30:30] [speaker-2] To me,
[00:30:30] [speaker-2] these are all extrinsic factors,
[00:30:32] [speaker-2] meaning these are things that will change over time.
[00:30:34] [speaker-2] These are not like fundamental properties of a particular technology,
[00:30:38] [speaker-2] which is kind of what intrinsic property would be,
[00:30:40] [speaker-2] right?
[00:30:42] [speaker-2] Of the system,
[00:30:43] [speaker-2] so yeah,
[00:30:44] [speaker-2] we have a you know if you want to use Quick today,
[00:30:48] [speaker-2] you kind of have to like really understand the value proposition you're going after and say like,
[00:30:54] [speaker-2] hey,
[00:30:54] [speaker-2] this is this is worth the trouble because you know there isn't yet this support system that we have.
[00:31:01] [speaker-2] Having said that,
[00:31:02] [speaker-2] I think we have quite a lot of things already.
[00:31:04] [speaker-2] If you go to the Quick website,
[00:31:05] [speaker-2] there's a showcase.
[00:31:06] [speaker-2] We're actually we're just rebuilding this to making it easier,
[00:31:10] [speaker-2] but
[00:31:10] [speaker-2] I think we have quite a lot of existing community support.
[00:31:15] [speaker-2] You know,
[00:31:15] [speaker-2] we're—I'm just chatting with people who are doing image components,
[00:31:18] [speaker-2] who are doing form support,
[00:31:21] [speaker-2] who are trying to do existing component libraries for Quick.
[00:31:26] [speaker-2] Of course,
[00:31:26] [speaker-2] you can just wrap
[00:31:27] [speaker-2] Material components and so on.
[00:31:29] [speaker-2] So a lot of things I think is happening.
[00:31:31] [speaker-2] Authentication with different auth providers.
[00:31:34] [speaker-2] A lot of things is happening.
[00:31:36] [speaker-2] But it's just going to take some time,
[00:31:37] [speaker-2] right?
[00:31:37] [speaker-2] And so we're at the beginning of the stage,
[00:31:39] [speaker-2] right?
[00:31:39] [speaker-2] We're not even at version one point zero.
[00:31:44] [speaker-8] Yeah,
[00:31:44] [speaker-8] I could just follow on to that.
[00:31:48] [speaker-8] So I think like Quick has probably the most correct architecture.
[00:31:52] [speaker-8] Like if you put a gun to my head and said which thing is the right way to build a website,
[00:31:56] [speaker-8] I'd probably pick Quick.
[00:31:57] [speaker-8] One thing that we did for this particular client is they're both on Next.js,
[00:32:01] [speaker-8] as Rayus mentioned.
[00:32:03] [speaker-8] So we said,
[00:32:03] [speaker-8] all right.
[00:32:03] [speaker-8] Let's take some lessons learned from Quick and see what we can implement in Next.js without a full rewrite.
[00:32:08] [speaker-8] So we did a little POC recently where we said,
[00:32:12] [speaker-8] let's try to go very aggressive with bundle splitting.
[00:32:14] [speaker-8] So let's dynamically import all of the things,
[00:32:17] [speaker-8] basically,
[00:32:18] [speaker-8] and let's defer even downloading the JavaScript from the client until certain components have been interacted with.
[00:32:27] [speaker-8] And this had the expected impact that we anticipated for TBT,
[00:32:31] [speaker-8] so total blocking time.
[00:32:33] [speaker-8] Had a huge spike in performance,
[00:32:36] [speaker-8] but what we did see there were some visual issues.
[00:32:38] [speaker-8] So one example was when you clicked on the hamburger menu on mobile,
[00:32:42] [speaker-8] and you expect the navigation to app to open up.
[00:32:45] [speaker-8] You have all these flyout menus,
[00:32:47] [speaker-8] images that load in,
[00:32:48] [speaker-8] components,
[00:32:49] [speaker-8] fonts,
[00:32:49] [speaker-8] etc.
[00:32:50] [speaker-8] There was a visible delay.
[00:32:52] [speaker-8] I'll put it that way.
[00:32:54] [speaker-8] We aren't talking a half second,
[00:32:56] [speaker-8] but maybe a hundred,
[00:32:58] [speaker-8] two hundred milliseconds of delay.
[00:32:59] [speaker-8] So you would tap,
[00:33:00] [speaker-8] and you would like it was long enough that you would be like.
[00:33:02] [speaker-8] Did I really tap that?
[00:33:03] [speaker-8] I'm not sure,
[00:33:04] [speaker-8] and then it would show up.
[00:33:05] [speaker-8] So I'm not sure if you know you or other people have seen any issues where,
[00:33:09] [speaker-8] like this aggressive code splitting and dynamically loading JavaScript on interaction,
[00:33:14] [speaker-8] has had any adverse user experience impacts.
[00:33:18] [speaker-2] Yeah,
[00:33:18] [speaker-2] that's that's a good question.
[00:33:19] [speaker-2] Actually,
[00:33:19] [speaker-2] a lot of people ask that.
[00:33:20] [speaker-2] So,
[00:33:22] [speaker-2] absolutely,
[00:33:22] [speaker-2] if you lazy load code on interaction,
[00:33:26] [speaker-2] you will see that,
[00:33:27] [speaker-2] and that's going to be a problem.
[00:33:29] [speaker-2] This is why.
[00:33:30] [speaker-2] We actually have ways of mitigating this,
[00:33:32] [speaker-2] and I think what you're discovering is that you're trying to take the lessons learned from Quik and trying to apply it to an existing system,
[00:33:40] [speaker-2] and then the existing system is really not really cooperating,
[00:33:44] [speaker-2] right?
[00:33:44] [speaker-2] Because it wasn't designed for this particular bit.
[00:33:47] [speaker-2] So the way Quik solves this particular problem is that we have a service worker,
[00:33:51] [speaker-2] and the service worker's job is to pre-populate the cache,
[00:33:54] [speaker-2] so that when the user goes and clicks on a hamburger menu.
[00:33:59] [speaker-2] And the the framework starts lazy loading the code and lazy executing the code associated with the hamburger menu.
[00:34:06] [speaker-2] The code is already in the sitting cache,
[00:34:08] [speaker-2] and therefore you don't have the two hundred millisecond delay.
[00:34:11] [speaker-2] It's basically instant,
[00:34:12] [speaker-2] right?
[00:34:13] [speaker-2] And so if you look at existing systems,
[00:34:15] [speaker-2] like for example,
[00:34:16] [speaker-2] you lazy loaded everything.
[00:34:17] [speaker-2] You discovered like,
[00:34:18] [speaker-2] hey,
[00:34:19] [speaker-2] now you have to solve the next problem,
[00:34:21] [speaker-2] and the next problem is making sure that the cache has the right assets.
[00:34:26] [speaker-2] And existing frameworks will not.
[00:34:28] [speaker-2] Do anything to kind of help you in this department,
[00:34:30] [speaker-2] right?
[00:34:31] [speaker-2] Like it's up to you as a developer to kind of write this.
[00:34:33] [speaker-2] Whereas in Quick,
[00:34:35] [speaker-2] we kind of thought about this problem and said,
[00:34:37] [speaker-2] "Hey,
[00:34:37] [speaker-2] you know,
[00:34:37] [speaker-2] yes,
[00:34:38] [speaker-2] if you start executing code lazily,
[00:34:40] [speaker-2] you will have a problem of delay.
[00:34:42] [speaker-2] How do we make sure that that doesn't happen?
[00:34:43] [speaker-2] Well,
[00:34:44] [speaker-2] we have to make sure that certain bundles get eagerly downloaded and placed inside of the cache,
[00:34:50] [speaker-2] so that when the user does interact,
[00:34:51] [speaker-2] there is no delay available to them.
[00:34:54] [speaker-2] And to do that,
[00:34:55] [speaker-2] now you have to you're in the business of knowing like
[00:34:57] [speaker-2] So,
[00:34:58] [speaker-2] which bundle contains which code,
[00:34:59] [speaker-2] and which order should the bundles be downloaded?
[00:35:02] [speaker-2] Do I download all the bundles or only some of the bundles?
[00:35:04] [speaker-2] Right.
[00:35:04] [speaker-2] And so,
[00:35:05] [speaker-2] again,
[00:35:06] [speaker-2] existing frameworks just have no opinion on this particular matter,
[00:35:10] [speaker-2] and this is where like Quick has an opinion.
[00:35:12] [speaker-2] So Quick can keep track of the the usage of what the user does,
[00:35:17] [speaker-2] and based on that,
[00:35:18] [speaker-2] you can provide statistical information to you as a developer that says like,
[00:35:21] [speaker-2] ah,
[00:35:22] [speaker-2] people more normally click on this button first,
[00:35:24] [speaker-2] so make sure you download the bundle with that thing.
[00:35:26] [speaker-2] Available first,
[00:35:27] [speaker-2] and and all of this information as to what bundles to download in which order,
[00:35:31] [speaker-2] etc.,
[00:35:32] [speaker-2] all of that becomes just configuration information too quick.
[00:35:35] [speaker-2] That is relatively easy to kind of tweak and improve.
[00:35:38] [speaker-2] Whereas,
[00:35:39] [speaker-2] you know,
[00:35:40] [speaker-2] if you wanted to change the way the bundles are structured in existing system,
[00:35:43] [speaker-2] you actually have to go to the source code and either add more dynamic imports or remove dynamic imports.
[00:35:48] [speaker-2] Right?
[00:35:48] [speaker-2] It's not something that's just automatic.
[00:35:50] [speaker-2] So again,
[00:35:51] [speaker-2] like
[00:35:52] [speaker-2] I think you're discovering the case of like.
[00:35:54] [speaker-2] Yes,
[00:35:55] [speaker-2] I'm going to take some of the ideas that Quick has,
[00:35:57] [speaker-2] and I'm trying to implement them in existing systems that are really not designed for this.
[00:36:01] [speaker-2] And I'm running into all kinds of kind of problems or surprises.
[00:36:04] [speaker-2] And now these problems or surprises are your problem as a developer; they're not the framework's problem.
[00:36:10] [speaker-2] And I think that's kind of the big difference with Quick.
[00:36:12] [speaker-2] Is that with Quick,
[00:36:13] [speaker-2] like,
[00:36:13] [speaker-2] no,
[00:36:13] [speaker-2] this is the framework's problem,
[00:36:15] [speaker-2] and so you don't have to think about it as a developer.
[00:36:20] [speaker-2] Hopefully,
[00:36:21] [speaker-2] that hits it.
[00:36:23] [speaker-2] No,
[00:36:23] [speaker-8] that does answer the question.
[00:36:24] [speaker-8] I need to peruse the docs a little bit to figure out the service worker magic.
[00:36:28] [speaker-8] I mean,
[00:36:28] [speaker-8] not that I'm unfamiliar with service workers,
[00:36:30] [speaker-8] but understanding how,
[00:36:31] [speaker-8] at compile time or runtime,
[00:36:33] [speaker-8] we're determining what bundles or scripts should be loaded eagerly because their you know user interaction will depend on them,
[00:36:40] [speaker-8] and making sure that they're available.
[00:36:42] [speaker-1] Yeah,
[00:36:43] [speaker-1] I have two of our two blog posts to the top that are related to this,
[00:36:47] [speaker-1] and if you want to speak about this a little more,
[00:36:49] [speaker-1] Mishko,
[00:36:50] [speaker-1] feel free.
[00:36:50] [speaker-2] Yes,
[00:36:51] [speaker-2] yes,
[00:36:51] [speaker-2] yes.
[00:36:52] [speaker-2] Yeah,
[00:36:52] [speaker-2] so we call it the speculative fetching of code.
[00:36:55] [speaker-2] In order for this to actually work,
[00:36:57] [speaker-2] you need an interesting part,
[00:36:58] [speaker-2] which is,
[00:36:59] [speaker-2] you know,
[00:36:59] [speaker-2] I keep discovering that like Quick has these concepts that don't have an analog in other frameworks.
[00:37:05] [speaker-2] So,
[00:37:05] [speaker-2] for example,
[00:37:06] [speaker-2] one of the concepts that we have in Quick is this idea that the framework at runtime understands the graph of all the objects,
[00:37:14] [speaker-2] meaning it understands what bundles are exist in a system,
[00:37:18] [speaker-2] and it understands.
[00:37:19] [speaker-2] Like if I load bundle A,
[00:37:21] [speaker-2] I will also have to load bundle C,
[00:37:23] [speaker-2] and if I want to get a click listener for this particular button,
[00:37:27] [speaker-2] then I know that's going to be found in bundle whatever G or something like that,
[00:37:31] [speaker-2] right?
[00:37:32] [speaker-2] So the the framework itself understands the graph of of kind of the the the bundles and the symbols available inside of it,
[00:37:41] [speaker-2] and there is no equivalent like that in existing systems.
[00:37:43] [speaker-2] Like in existing systems,
[00:37:44] [speaker-2] if you take your source code and you feed it through a bundling system.
[00:37:49] [speaker-2] The bundling system doesn't tell you anything about like how the bundles are related,
[00:37:54] [speaker-2] what symbol ended up where.
[00:37:56] [speaker-2] You're kind of on your own,
[00:37:57] [speaker-2] right?
[00:37:57] [speaker-2] And it turns out that having that information,
[00:37:59] [speaker-2] having that graph,
[00:38:00] [speaker-2] is what then enables you to do other things,
[00:38:02] [speaker-2] such as speculative loading of code,
[00:38:04] [speaker-2] so that when a user finally clicks on a button,
[00:38:08] [speaker-2] you know that it's gonna the code is gonna be waiting for the user in the cache,
[00:38:12] [speaker-2] and there will be no delay.
[00:38:13] [speaker-1] There will be nothing visual that is kind of annoying.
[00:38:24] [speaker-1] Yo,
[00:38:24] [speaker-1] Jen,
[00:38:25] [speaker-1] do you have any questions?
[00:38:28] [speaker-9] I do have to remember my question now.
[00:38:33] [speaker-9] And hello,
[00:38:33] [speaker-9] everyone.
[00:38:34] [speaker-1] Why don't you introduce yourself real quick while you are thinking of it?
[00:38:37] [speaker-9] Yeah,
[00:38:37] [speaker-9] I guess this is the exciting time.
[00:38:39] [speaker-9] And Michko,
[00:38:40] [speaker-9] thank you for being on the show eight months ago.
[00:38:43] [speaker-9] It's crazy to think about that.
[00:38:46] [speaker-9] I,
[00:38:46] [speaker-9] my name is Jen Janot.
[00:38:48] [speaker-9] I am a developer advocate at Ivan,
[00:38:50] [speaker-9] a data infrastructure company.
[00:38:53] [speaker-9] And I also have two shows.
[00:38:55] [speaker-9] One called Teach Gen Tech,
[00:38:57] [speaker-9] where I first met Anthony and Mishko.
[00:39:00] [speaker-9] They have both been on the show.
[00:39:02] [speaker-9] And I also oh,
[00:39:03] [speaker-9] and I see Nick.
[00:39:04] [speaker-9] Nick's been on the show too.
[00:39:06] [speaker-9] And
[00:39:07] [speaker-9] I also have a show called Shit You Don't Want to Talk About,
[00:39:10] [speaker-9] where we talk about mental health and neurodiversity.
[00:39:14] [speaker-9] And yeah,
[00:39:15] [speaker-9] it's been a.
[00:39:17] [speaker-9] I had no idea any coding back in like.
[00:39:20] [speaker-9] July two thousand and twenty-two.
[00:39:21] [speaker-9] So we're almost to a year.
[00:39:23] [speaker-9] We are almost there.
[00:39:24] [speaker-9] And for those who might not have been here at the very beginning of the space,
[00:39:30] [speaker-9] Anthony was complimenting Mishko on coming on my show and teaching me what Quick was when I didn't know what Hacker News was.
[00:39:42] [speaker-1] What was your impression of kind of learning Quick at the time?
[00:39:45] [speaker-1] Did it seem like overwhelming,
[00:39:47] [speaker-1] or did
[00:39:47] [speaker-1] Feel like just kind of learning another thing,
[00:39:49] [speaker-1] like you like the way you learned React,
[00:39:51] [speaker-1] because I I feel like with beginners,
[00:39:54] [speaker-1] you know,
[00:39:55] [speaker-1] you can kind of give them any framework and start teaching them.
[00:39:57] [speaker-1] They're all going to be equally confusing,
[00:39:59] [speaker-1] you know.
[00:39:59] [speaker-1] So I feel like Quick might have been just like another framework for you.
[00:40:06] [speaker-9] Yes,
[00:40:07] [speaker-9] although I would say when we started going into the
[00:40:13] [speaker-9] Dev tools.
[00:40:14] [speaker-9] And looking at the load times to compare them,
[00:40:18] [speaker-9] it made a lot more sense because my previous time was at
[00:40:23] [speaker-9] GoDaddy, and of course,
[00:40:25] [speaker-9] I always heard of people like hating that their websites was were loading really slow.
[00:40:30] [speaker-9] So it was really cool to see how,
[00:40:34] [speaker-9] like,
[00:40:34] [speaker-9] the website only loaded what it needed to load instead of absolutely everything,
[00:40:41] [speaker-9] when that could slow down a website.
[00:40:47] [speaker-1] Nice,
[00:40:47] [speaker-1] yeah,
[00:40:47] [speaker-1] that is that's the idea.
[00:40:49] [speaker-9] But I do remember my question because
[00:40:51] [speaker-9] I was super excited lately that I'm I'm building.
[00:40:56] [speaker-9] I built one website in Astro,
[00:40:58] [speaker-9] and now I'm building another site in Astro.
[00:41:00] [speaker-9] And I was like,
[00:41:00] [speaker-9] you know,
[00:41:01] [speaker-9] I should probably try a different framework eventually.
[00:41:04] [speaker-9] And I just saw on
[00:41:07] [speaker-9] Builder that you can do quick with Builder,
[00:41:10] [speaker-9] so now I'm really excited to try that one out.
[00:41:13] [speaker-9] But this question is for all of you:
[00:41:15] [speaker-9] like,
[00:41:16] [speaker-9] what?
[00:41:17] [speaker-9] App,
[00:41:18] [speaker-9] would you say to anybody to build their sites with or build things with to be able to test out and really see the differences of frameworks?
[00:41:30] [speaker-2] You know,
[00:41:31] [speaker-2] that's that's a hard question because,
[00:41:32] [speaker-2] like,
[00:41:32] [speaker-2] I feel like the differences between frameworks don't really come to be until your application gets ridiculously large.
[00:41:40] [speaker-2] Um,
[00:41:41] [speaker-2] like the thing is,
[00:41:42] [speaker-2] like any.
[00:41:43] [speaker-2] Any framework,
[00:41:44] [speaker-2] when you build a hello world,
[00:41:45] [speaker-2] or to do list,
[00:41:46] [speaker-2] or movie app,
[00:41:46] [speaker-2] or any of those basic ones,
[00:41:49] [speaker-2] will be just fine,
[00:41:50] [speaker-2] and you know things won't really break under pressure because well,
[00:41:53] [speaker-2] there's just not a lot of it just yet,
[00:41:55] [speaker-2] right?
[00:41:56] [speaker-2] It's when you build a full size,
[00:41:58] [speaker-2] you know,
[00:41:59] [speaker-2] application that has hundreds or maybe even thousands of components that's where the size really comes into play,
[00:42:06] [speaker-2] and all these tricks start to matter.
[00:42:10] [speaker-1] Yeah,
[00:42:10] [speaker-1] there used to be something called the real world app.
[00:42:13] [speaker-1] Which was kind of like a clone of like Medium,
[00:42:16] [speaker-1] the the blogging platform.
[00:42:18] [speaker-1] So that's one that used to be really popular to be built in every framework.
[00:42:21] [speaker-1] And then there was like To Do MVC,
[00:42:24] [speaker-1] and now we have the the movie app is becoming a big one.
[00:42:27] [speaker-1] This is always a problem.
[00:42:28] [speaker-1] Is like how do we actually find something that can kind of show off the capabilities of each while also finding the kind of pain points?
[00:42:38] [speaker-1] I feel like benchmarking is good for kind of finding out where they break down.
[00:42:43] [speaker-1] But then,
[00:42:43] [speaker-1] just building some sort of like usable app that has users is a good kind of exercise for a developer to go through,
[00:42:51] [speaker-1] because then they have to go through all the different pieces of the framework to make that happen.
[00:42:55] [speaker-1] So,
[00:42:56] [speaker-1] yeah,
[00:42:56] [speaker-1] does that kind of answer your question,
[00:42:57] [speaker-1] Jen?
[00:42:59] [speaker-2] Let me just add something to it.
[00:43:00] [speaker-2] Sorry for jumping in front of you.
[00:43:02] [speaker-2] Is
[00:43:03] [speaker-2] I think something like two M V C is great to discover what the developer experience is for the developer.
[00:43:10] [speaker-2] Right?
[00:43:11] [speaker-2] Might not be necessarily.
[00:43:12] [speaker-2] Best thing to discover when the framework will break under load,
[00:43:16] [speaker-2] but it certainly is great as a developer to kind of learn about stuff.
[00:43:21] [speaker-9] I'm thinking because,
[00:43:23] [speaker-9] of course,
[00:43:23] [speaker-9] I'm learning now.
[00:43:24] [speaker-9] I'm basing everything on data infrastructure and learning that from scratch.
[00:43:29] [speaker-9] So,
[00:43:30] [speaker-9] I I think something that I don't know if these two concepts go together.
[00:43:35] [speaker-9] Of like,
[00:43:36] [speaker-9] there are datasets that we can use that are public.
[00:43:40] [speaker-9] That can be used to be able to put into like yesterday's show was about Kafka.
[00:43:46] [speaker-9] Is there something like that that could be used to test frameworks,
[00:43:50] [speaker-9] or is that like putting two ideas that don't go together?
[00:43:56] [speaker-2] I think it's not about the amount of data the framework has to show; it's about the amount of code that's associated with that application,
[00:44:02] [speaker-2] right?
[00:44:03] [speaker-2] So,
[00:44:03] [speaker-2] like,
[00:44:03] [speaker-2] you need to get a application that's complicated enough that it has sufficient amount of code,
[00:44:08] [speaker-2] sufficient number of
[00:44:10] [speaker-2] Different developers who went through it and refactored the code in different ways,
[00:44:14] [speaker-2] and of course,
[00:44:15] [speaker-2] whenever you do refactoring,
[00:44:16] [speaker-2] you always do it eighty percent of the way,
[00:44:17] [speaker-2] right?
[00:44:17] [speaker-2] And the last twenty percent is left the other way.
[00:44:20] [speaker-2] It's only then where I think you discover like how these things actually scale.
[00:44:27] [speaker-9] That makes sense.
[00:44:27] [speaker-9] Thank you.
[00:44:33] [speaker-4] Actually,
[00:44:34] [speaker-4] this this reminds me of another problem that we're seeing.
[00:44:39] [speaker-4] In a lot of enterprise e-commerce and other other kinds of websites that our teams are building,
[00:44:47] [speaker-4] which is that you build a a pretty decent website with any framework.
[00:44:52] [speaker-4] It could be
[00:44:53] [speaker-4] Next.js, Next,
[00:44:54] [speaker-4] or or any other framework.
[00:44:56] [speaker-4] And then what happens is when it is deployed to production,
[00:45:00] [speaker-4] there is a huge amount of mark tech like you know Google Analytics,
[00:45:05] [speaker-4] you know bot scripts.
[00:45:08] [speaker-4] Hotjar,
[00:45:09] [speaker-4] other kinds of services,
[00:45:10] [speaker-4] scripts that are added to the page,
[00:45:13] [speaker-4] and that is actually where the majority of the of the
[00:45:19] [speaker-4] JavaScript is coming from.
[00:45:22] [speaker-4] So,
[00:45:22] [speaker-4] Misko mentioned Worker Dollar,
[00:45:27] [speaker-4] like some something similar to
[00:45:29] [speaker-4] Server Dollar primitive that that exists in Quicker now.
[00:45:34] [speaker-4] Is there?
[00:45:35] [speaker-4] I know that.
[00:45:39] [speaker-4] There's this Party Town framework that exists,
[00:45:44] [speaker-4] but the last time we tried to use it,
[00:45:46] [speaker-4] it's like it's it requires a lot of manual work.
[00:45:50] [speaker-4] So are are you working on something that that would make that manual work easier or reduce the amount of manual work required to move that into a worker?
[00:46:03] [speaker-1] Party Town meta framework?
[00:46:05] [speaker-1] Yeah.
[00:46:07] [speaker-2] Yeah,
[00:46:07] [speaker-2] Party Town is definitely the the answer I would give here.
[00:46:11] [speaker-2] You know,
[00:46:12] [speaker-2] for third party code,
[00:46:14] [speaker-2] you're right.
[00:46:14] [speaker-2] It is not as streamlined as we would like it to be.
[00:46:18] [speaker-2] It is a hard problem,
[00:46:19] [speaker-2] right?
[00:46:19] [speaker-2] Like you can't just take code and just run it in the web worker and expect it to just kind of work out of the box.
[00:46:24] [speaker-2] So there's lots of hoops and complications there.
[00:46:28] [speaker-2] But yeah,
[00:46:28] [speaker-2] it's it's the best we have so far in this particular department,
[00:46:31] [speaker-2] right?
[00:46:31] [speaker-2] If you you know,
[00:46:33] [speaker-2] as you correctly observed.
[00:46:36] [speaker-2] When you build large scale application,
[00:46:38] [speaker-2] third party code is a huge part of it,
[00:46:41] [speaker-2] and I think Google reports that on average,
[00:46:43] [speaker-2] websites have something like twenty one different third party domains or script tags on their on their page,
[00:46:49] [speaker-2] and that's a lot,
[00:46:50] [speaker-2] right?
[00:46:50] [speaker-2] And so,
[00:46:51] [speaker-2] figuring out how to make sure that the the third party scripts can be better about the way they run is something that certainly would help,
[00:47:00] [speaker-2] and so part of time is the way to do it.
[00:47:02] [speaker-2] Actually,
[00:47:02] [speaker-2] I'm kind of
[00:47:03] [speaker-2] Come around in the particular point of view now,
[00:47:05] [speaker-2] and I think many of these third-party scripts could be written in Quick,
[00:47:11] [speaker-2] and I think they would perform better.
[00:47:13] [speaker-2] You know,
[00:47:13] [speaker-2] because if you think about it,
[00:47:14] [speaker-2] what all these third-party scripts do on initialization is they they just run tons of code and like registers listeners and sets this thing up and the other thing,
[00:47:22] [speaker-2] etc.
[00:47:23] [speaker-2] And many of these things could be simplified if they just weren't weren't there.
[00:47:30] [speaker-2] So.
[00:47:31] [speaker-2] The initialization,
[00:47:32] [speaker-2] right,
[00:47:32] [speaker-2] the the resumability of the system is kind of what you would be looking for,
[00:47:36] [speaker-2] and if you could do that for third-party code,
[00:47:38] [speaker-2] I think you would gain a lot of benefits.
[00:47:40] [speaker-2] But that's kind of down the line,
[00:47:41] [speaker-2] right?
[00:47:41] [speaker-2] Like immediately,
[00:47:42] [speaker-2] I think
[00:47:43] [speaker-2] Party Town is the only really option that's available to us.
[00:47:46] [speaker-1] We have a question from the audience:
[00:47:49] [speaker-1] Will Worker Dollar Sign make most third-party code that's not supported by Party Town finally work?
[00:47:57] [speaker-2] I think those are two separate things.
[00:47:59] [speaker-2] Like Worker dollar sign would be like the code that you have written,
[00:48:03] [speaker-2] so that you want to run it on a web worker.
[00:48:05] [speaker-2] Party Town is really for code that somebody else has written,
[00:48:09] [speaker-2] and you want to make it run in the web worker,
[00:48:10] [speaker-2] right?
[00:48:11] [speaker-2] So this is a very different kind of use case.
[00:48:13] [speaker-1] I don't see them as overlapping.
[00:48:19] [speaker-1] Okay,
[00:48:19] [speaker-1] gotcha.
[00:48:23] [speaker-1] Um,
[00:48:23] [speaker-1] Dev,
[00:48:24] [speaker-1] welcome to the stage.
[00:48:27] [speaker-10] Hello,
[00:48:27] [speaker-10] hello.
[00:48:29] [speaker-10] I can go next,
[00:48:29] [speaker-10] but Ellery has his hand up,
[00:48:31] [speaker-10] so like,
[00:48:31] [speaker-1] yeah,
[00:48:32] [speaker-1] sounds good.
[00:48:32] [speaker-1] Let's do that.
[00:48:35] [speaker-8] Cool.
[00:48:35] [speaker-8] While we're talking about Party Town,
[00:48:37] [speaker-8] I just wanted to ask:
[00:48:38] [speaker-8] Have you had any large-scale customers implement Party Town?
[00:48:41] [speaker-8] I know it's still a beta product.
[00:48:44] [speaker-8] In my experience with it,
[00:48:45] [speaker-8] I found that it makes simple things faster and complicated things extremely painful.
[00:48:52] [speaker-8] Like,
[00:48:52] [speaker-8] if you have a couple of marketing scripts,
[00:48:54] [speaker-8] it probably works well,
[00:48:55] [speaker-8] but
[00:48:55] [speaker-8] For like large enterprise accounts that have twenty,
[00:48:58] [speaker-8] thirty distinct marketing scripts,
[00:49:00] [speaker-8] things that want to write directly to the data layer that are third party scripts,
[00:49:03] [speaker-8] and now you have to intercept that and glue things together.
[00:49:06] [speaker-8] It was pretty tedious to get things going.
[00:49:09] [speaker-8] So just curious,
[00:49:10] [speaker-8] like if there's any plans to expand that,
[00:49:12] [speaker-8] include support for more third parties,
[00:49:15] [speaker-8] and maybe see it in a live production site that has you know a bunch of Martech scripts running on it.
[00:49:21] [speaker-2] Yeah.
[00:49:21] [speaker-2] So the hard part about Party Town is that you're essentially emulating.
[00:49:26] [speaker-2] The browser in a web worker,
[00:49:27] [speaker-2] right?
[00:49:27] [speaker-2] The the web worker doesn't have all of the browser APIs like DOM,
[00:49:31] [speaker-2] etc.
[00:49:31] [speaker-2] So you have to do an emulation.
[00:49:33] [speaker-2] And the thing with emulators is that it's easy to get eighty percent,
[00:49:38] [speaker-2] and it's in every additional percentage point,
[00:49:40] [speaker-2] right?
[00:49:41] [speaker-2] To want to get in terms of like the accuracy becomes more and more difficult.
[00:49:45] [speaker-2] And so the thing with Party Town is that it is it is very very difficult to get.
[00:49:51] [speaker-2] I mean,
[00:49:52] [speaker-2] it's possible,
[00:49:52] [speaker-2] but it's just the amount of time you have to put into it is pretty high.
[00:49:56] [speaker-2] And currently,
[00:49:57] [speaker-2] we're just as as a company builder has decided to put its resources behind Quick right now because,
[00:50:05] [speaker-2] like,
[00:50:05] [speaker-2] that's a direct benefit to the customers in terms of the code that they own.
[00:50:11] [speaker-2] And so,
[00:50:12] [speaker-2] Party Town is not getting as much love as it would deserve.
[00:50:15] [speaker-2] I still think it's a pretty cool technology that that can go places.
[00:50:20] [speaker-2] But it is a hard thing because,
[00:50:21] [speaker-2] like,
[00:50:21] [speaker-2] when things don't work,
[00:50:22] [speaker-2] as you point out,
[00:50:23] [speaker-2] you know,
[00:50:23] [speaker-2] the thing you,
[00:50:24] [speaker-2] the issue you have is that you have now a third-party minified script that is throwing some exception,
[00:50:31] [speaker-2] and good luck figuring out in the minified code base that is not even yours,
[00:50:34] [speaker-2] you know,
[00:50:35] [speaker-2] what's going on,
[00:50:36] [speaker-2] why this exception is being thrown,
[00:50:37] [speaker-2] you know,
[00:50:38] [speaker-2] what particular bit have you not emulated correctly enough that you know the the third-party code is kind of being confused about it.
[00:50:46] [speaker-2] I think the the way to get around this particular problem.
[00:50:49] [speaker-2] Is to almost like create a certification pro program for third-party providers,
[00:50:55] [speaker-2] and basically say like,
[00:50:56] [speaker-2] hey,
[00:50:57] [speaker-2] wouldn't it be great if the third-party provider would test their own code with Party Town,
[00:51:01] [speaker-2] verify that it works,
[00:51:03] [speaker-2] and you know there were no surprises,
[00:51:04] [speaker-2] and if there are,
[00:51:05] [speaker-2] either fix it in their side or fix it in Party Town,
[00:51:07] [speaker-2] you know,
[00:51:08] [speaker-2] while it's not minified,
[00:51:10] [speaker-2] and then that would become almost like a a value add,
[00:51:14] [speaker-2] right?
[00:51:14] [speaker-2] That you could just brag on your side,
[00:51:16] [speaker-2] like,
[00:51:16] [speaker-2] hey,
[00:51:16] [speaker-2] our our third-party script.
[00:51:18] [speaker-2] Runs in party towns,
[00:51:18] [speaker-2] so like we we made sure that the setup is easy,
[00:51:21] [speaker-2] etc.
[00:51:22] [speaker-2] So I'm chatting actually with folks at Google about this to see if we could have some kind of a certification program like that.
[00:51:28] [speaker-2] We haven't gotten very far,
[00:51:29] [speaker-2] but I think that's the way to kind of solve this because solving it by just trying to brutally go through every single discrepancy in behavior it just puts a huge amount of resource drain on us,
[00:51:44] [speaker-2] and it's not a simple,
[00:51:45] [speaker-2] straightforward thing to do.
[00:51:48] [speaker-8] Yeah,
[00:51:48] [speaker-8] I was almost questioning at one point whether it was the right solution—just taking compute,
[00:51:54] [speaker-8] moving it to worker threads versus something like Zeraz or server-side tagging,
[00:51:59] [speaker-8] which I think Google Analytics supports.
[00:52:02] [speaker-8] I think that's probably where the future is in my mind.
[00:52:04] [speaker-8] That I have one,
[00:52:06] [speaker-8] you know,
[00:52:07] [speaker-8] Martech script in my site that publishes events with enough data for you know a wide array of other third-party scripts to consume from,
[00:52:16] [speaker-8] and it just fans out.
[00:52:17] [speaker-8] In the server to everyone.
[00:52:19] [speaker-2] Yeah,
[00:52:20] [speaker-2] absolutely.
[00:52:20] [speaker-2] There's,
[00:52:20] [speaker-2] there's definitely other ways of solving this problem.
[00:52:23] [speaker-2] I think Party Town just takes it from the point of view of like,
[00:52:26] [speaker-2] given the the world that as it is today with these things,
[00:52:30] [speaker-2] these third-party scripts as they are today,
[00:52:32] [speaker-2] you know,
[00:52:33] [speaker-2] what's the best we can do?
[00:52:34] [speaker-2] And so,
[00:52:34] [speaker-2] like,
[00:52:34] [speaker-2] the Party Town is the answer to that.
[00:52:36] [speaker-2] But if you're willing to change what the status quo is in the world,
[00:52:39] [speaker-2] you know,
[00:52:39] [speaker-2] like that we just move code to the server.
[00:52:42] [speaker-2] Yeah,
[00:52:42] [speaker-2] absolutely,
[00:52:42] [speaker-2] that would be a better solution to the problem,
[00:52:44] [speaker-2] right?
[00:52:45] [speaker-2] But we're not there yet as an as an ecosystem.
[00:52:53] [speaker-1] I don't know if anyone here watches the show Party Down.
[00:52:56] [speaker-1] Every time now I hear Party Town,
[00:52:58] [speaker-1] it kind of makes me think of Party Down.
[00:53:00] [speaker-1] Very good show.
[00:53:01] [speaker-1] People haven't checked it out.
[00:53:03] [speaker-1] I've never heard of it.
[00:53:04] [speaker-2] I'll check it out.
[00:53:05] [speaker-1] Yeah,
[00:53:05] [speaker-1] it just had a reboot.
[00:53:06] [speaker-1] Actually,
[00:53:08] [speaker-1] Dev,
[00:53:08] [speaker-1] do you want to hop in here?
[00:53:11] [speaker-10] Yeah,
[00:53:11] [speaker-10] how's it going?
[00:53:12] [speaker-10] So I had a question about Quick,
[00:53:15] [speaker-10] Mishko.
[00:53:15] [speaker-10] You started the space by like saying that Quick is the performance framework.
[00:53:21] [speaker-10] And you achieve the initial bundle size,
[00:53:24] [speaker-10] like you reduce the bundle size by basically lazy loading the interactive bits,
[00:53:30] [speaker-10] and they're loaded once the user actually interacts with them.
[00:53:33] [speaker-10] Right.
[00:53:34] [speaker-10] So once they are loaded,
[00:53:36] [speaker-10] the interactive bits.
[00:53:38] [speaker-10] There is another dimension of performance,
[00:53:40] [speaker-10] which is when I click a button or when I open a dialog,
[00:53:43] [speaker-10] how quickly are those?
[00:53:45] [speaker-10] How quickly do do those things appear on the screen?
[00:53:47] [speaker-10] How much work does the CPU have to do to get there?
[00:53:50] [speaker-10] Or when new data is fetched from the server,
[00:53:52] [speaker-10] how quickly is that displayed on the UI?
[00:53:55] [speaker-10] So I know Quik has a virtual DOM,
[00:53:57] [speaker-10] but Quik also has signals.
[00:53:59] [speaker-10] So I was hoping to get some information about what does that interactivity look like?
[00:54:05] [speaker-10] How do how does it work with signals and V DOM?
[00:54:09] [speaker-2] Yeah,
[00:54:09] [speaker-2] good question.
[00:54:10] [speaker-2] Yeah,
[00:54:11] [speaker-2] so definitely there are two different dimensions here,
[00:54:12] [speaker-2] right?
[00:54:13] [speaker-2] There's the dimension of like how fast can we make the page interactive.
[00:54:16] [speaker-2] And a second dimension is once the page is interactive,
[00:54:19] [speaker-2] you know how fast can we update?
[00:54:21] [speaker-2] So in order to get the page interactive on your your site as soon as possible,
[00:54:27] [speaker-2] right?
[00:54:29] [speaker-2] Quick has to be super aggressive about lazy execution of the code.
[00:54:33] [speaker-2] And it turns out that if you want to be aggressive about lazy execution of the code,
[00:54:38] [speaker-2] solutions that are coarse grain reactive,
[00:54:41] [speaker-2] like for example
[00:54:42] [speaker-2] React or Angular,
[00:54:44] [speaker-2] right?
[00:54:44] [speaker-2] When you change something in React or Angular.
[00:54:47] [speaker-2] You are changing a state,
[00:54:48] [speaker-2] and the whole thing then propagates.
[00:54:49] [speaker-2] A lot of code executes,
[00:54:51] [speaker-2] and so things that are coarse-grained reactive do not play well with resumable systems because what's happening is that even if you can get the page up and running,
[00:55:04] [speaker-2] you know,
[00:55:04] [speaker-2] quickly because you delayed executed the code,
[00:55:07] [speaker-2] the first interaction will likely execute eighty percent of your application code,
[00:55:11] [speaker-2] right?
[00:55:12] [speaker-2] And that's kind of the problem that you're trying to avoid.
[00:55:15] [speaker-2] So.
[00:55:16] [speaker-2] Quick for that reason is fine grain reactive,
[00:55:18] [speaker-2] right?
[00:55:18] [speaker-2] So that when things update,
[00:55:21] [speaker-2] we want to be surgical about what we update.
[00:55:23] [speaker-2] So we do use VDOM sometimes,
[00:55:27] [speaker-2] but there should be a big caveat placed in there because the way
[00:55:32] [speaker-2] React uses VDOM is that it starts at a particular component,
[00:55:36] [speaker-2] and by default,
[00:55:38] [speaker-2] you know,
[00:55:38] [speaker-2] all child components get rendered underneath it.
[00:55:40] [speaker-2] Now,
[00:55:40] [speaker-2] there's ways to kind of
[00:55:42] [speaker-2] Short circuit that,
[00:55:43] [speaker-2] and you know,
[00:55:44] [speaker-2] make it render less.
[00:55:45] [speaker-2] But like the default behavior is that you start at the root,
[00:55:48] [speaker-2] and you kind of re-render everything below it.
[00:55:51] [speaker-2] The other thing that happens oftentimes in these systems is that because you put shared state in a common ancestor,
[00:55:59] [speaker-2] oftentimes you know your root component or somewhere close to the root component is where all of your state is.
[00:56:04] [speaker-2] So any modifications of the state tend to like re-render this whole tree for you,
[00:56:10] [speaker-2] and so that.
[00:56:10] [speaker-2] Has a negative impact on performance.
[00:56:13] [speaker-2] Rather,
[00:56:13] [speaker-2] the main issue there is that yes,
[00:56:17] [speaker-2] it's slower.
[00:56:18] [speaker-2] But the thing that we really care about is the fact that it forces you to download and execute a whole bunch of code that you otherwise wouldn't have to.
[00:56:25] [speaker-2] And so,
[00:56:26] [speaker-2] while
[00:56:27] [speaker-2] Quick does have VDom,
[00:56:28] [speaker-2] it is very good at basically updating just the component itself.
[00:56:33] [speaker-2] So,
[00:56:34] [speaker-2] if you have a situation where you have a let's say you have three components,
[00:56:37] [speaker-2] a root component.
[00:56:38] [speaker-2] And a child component that has a buy button,
[00:56:40] [speaker-2] and another child component that has the shopping cart,
[00:56:42] [speaker-2] right?
[00:56:43] [speaker-2] And so the shared common ancestor is the root component.
[00:56:47] [speaker-2] And then if you push the buy button,
[00:56:48] [speaker-2] you're updating state inside of the root component,
[00:56:51] [speaker-2] which then causes the shopping cart to update.
[00:56:53] [speaker-2] A common setup.
[00:56:55] [speaker-2] So in in default behaving systems,
[00:56:58] [speaker-2] the way this would work is that you would re-render everything from a root component.
[00:57:01] [speaker-2] In Quick,
[00:57:01] [speaker-2] what would happen is that because it's a fine-grain reactive,
[00:57:05] [speaker-2] the clicking of the buy button
[00:57:07] [speaker-2] Would then directly notify the shopping cart and would completely bypass the other components.
[00:57:13] [speaker-2] They wouldn't even have to download.
[00:57:14] [speaker-2] So even though
[00:57:16] [speaker-2] Quick, in that sense,
[00:57:16] [speaker-2] has a VDOM,
[00:57:19] [speaker-2] it it doesn't.
[00:57:21] [speaker-2] You know,
[00:57:21] [speaker-2] it it really prunes the tree automatically for you,
[00:57:24] [speaker-2] and it prunes it quite aggressively.
[00:57:26] [speaker-2] But what we've been doing lately in Quick with Signals is actually taking it into a whole new another level,
[00:57:32] [speaker-2] which is that if you have a component that doesn't have a structural change,
[00:57:36] [speaker-2] meaning like
[00:57:37] [speaker-2] If you have a component that has like an if statement in there,
[00:57:39] [speaker-2] or show A or show B depending on some flag,
[00:57:42] [speaker-2] that's a structural change to the DOM.
[00:57:44] [speaker-2] If your component doesn't have a structural change to the DOM,
[00:57:46] [speaker-2] it only has like updating a binding,
[00:57:48] [speaker-2] like current price or quantity or the total.
[00:57:52] [speaker-2] In that particular case,
[00:57:54] [speaker-2] we don't even have to download or execute the VDOM.
[00:57:56] [speaker-2] So if the change isn't structural,
[00:57:59] [speaker-2] then the whole VDOM doesn't even come into play,
[00:58:00] [speaker-2] and we don't even have to download the component or execute it or anything like that.
[00:58:04] [speaker-2] We can just directly go and update the
[00:58:07] [speaker-2] The DOM,
[00:58:08] [speaker-2] so
[00:58:09] [speaker-2] I would say that you know,
[00:58:13] [speaker-2] quick in terms of performance after you initially load the page,
[00:58:17] [speaker-2] is going to be somewhere between React and Solid JS.
[00:58:21] [speaker-2] Solid JS being like the undisputed king in terms of like how fast you you can go,
[00:58:27] [speaker-2] and then React is kind of the super popular,
[00:58:29] [speaker-2] but it kind of re renders,
[00:58:30] [speaker-2] I would say,
[00:58:31] [speaker-2] like too much by default.
[00:58:34] [speaker-2] So that's a pretty wide band.
[00:58:35] [speaker-2] But I would say we're probably closer to the solid side than we are in terms of the quick side,
[00:58:39] [speaker-2] because you know we have signals and we have this
[00:58:44] [speaker-2] VDOM pruning that happens pretty aggressively.
[00:58:47] [speaker-2] And so,
[00:58:48] [speaker-2] for the most operations that you will see,
[00:58:51] [speaker-2] you will actually not even bring VDOM into into play.
[00:58:54] [speaker-2] But having said that,
[00:58:55] [speaker-2] like I want to point out that there's a lot of websites out there written in React,
[00:59:00] [speaker-2] and for the most part,
[00:59:02] [speaker-2] once the application is up and running.
[00:59:04] [speaker-2] They're plenty fast,
[00:59:05] [speaker-2] right?
[00:59:06] [speaker-2] And so,
[00:59:08] [speaker-2] while yeah,
[00:59:08] [speaker-2] it's important to kind of focus on runtime performance.
[00:59:11] [speaker-2] I'm going to kind of argue that like it's it's a bit of a red herring in the sense that like just about any technology you choose,
[00:59:18] [speaker-2] usually you end up with a site that's plenty fast for you once it's up and running,
[00:59:23] [speaker-2] right?
[00:59:23] [speaker-2] It's the getting it up and running part that I think we have a problem as an industry,
[00:59:28] [speaker-2] and so that's the the part that really Quick wants to focus on.
[00:59:31] [speaker-2] But having said that,
[00:59:32] [speaker-2] right again,
[00:59:32] [speaker-2] like.
[00:59:33] [speaker-2] We're going to be still a lot faster than Quick.
[00:59:35] [speaker-2] We're going to be probably within,
[00:59:37] [speaker-2] you know,
[00:59:38] [speaker-2] reaching distance of what Solid does.
[00:59:43] [speaker-10] Yeah,
[00:59:43] [speaker-10] that's great.
[00:59:44] [speaker-10] I have just one quick follow up.
[00:59:45] [speaker-10] So it's great that you mentioned that the runtime performance is mostly a red herring,
[00:59:51] [speaker-10] because I think a lot of the discussion around signals has mostly been about the DX.
[00:59:56] [speaker-10] So what,
[00:59:58] [speaker-10] just where do you stand on like,
[01:00:00] [speaker-10] what do you think there are DX wins with signals?
[01:00:03] [speaker-10] Just apart from the performance,
[01:00:06] [speaker-2] yeah,
[01:00:06] [speaker-2] absolutely.
[01:00:06] [speaker-2] I love the DX of signals.
[01:00:09] [speaker-2] To us,
[01:00:10] [speaker-2] the real win of signals is not necessarily the performance,
[01:00:14] [speaker-2] which although that's nice,
[01:00:15] [speaker-2] but really it's the fact that signals allow us to not execute a whole bunch of code.
[01:00:21] [speaker-2] And the not executing code,
[01:00:23] [speaker-2] first of all,
[01:00:23] [speaker-2] certainly it's a performance thing that like makes the you know code run faster.
[01:00:27] [speaker-2] But the real benefit of that is that because I don't have to execute that code.
[01:00:32] [speaker-2] Quick doesn't have to then download the code,
[01:00:33] [speaker-2] right?
[01:00:34] [speaker-2] And so the win to us with signals is not necessarily that that they run faster; it's that they allow you to not execute and therefore not download a whole bunch of unnecessary code,
[01:00:44] [speaker-2] right?
[01:00:44] [speaker-2] And so you end up with smaller amount of code that has to get shipped to the browser.
[01:00:52] [speaker-10] Got it.
[01:00:52] [speaker-10] Thank you.
[01:01:01] [speaker-1] Scott,
[01:01:01] [speaker-1] we're at the hour mark.
[01:01:02] [speaker-1] You want to do a quick station break,
[01:01:05] [speaker-1] and then
[01:01:05] [speaker-1] Mishko. Um,
[01:01:06] [speaker-1] how how long do you have to go for?
[01:01:09] [speaker-2] I think I am.
[01:01:10] [speaker-1] I am free after the.
[01:01:11] [speaker-1] Oh well,
[01:01:14] [speaker-1] okay.
[01:01:15] [speaker-1] Just yeah,
[01:01:15] [speaker-1] at least half an hour.
[01:01:16] [speaker-1] Questions.
[01:01:18] [speaker-1] Great,
[01:01:18] [speaker-1] awesome.
[01:01:18] [speaker-2] We can we can go.
[01:01:19] [speaker-2] I mean,
[01:01:19] [speaker-2] half an hour for the scheduled one,
[01:01:21] [speaker-2] which was one thirty,
[01:01:21] [speaker-2] right?
[01:01:21] [speaker-2] So like,
[01:01:23] [speaker-2] yeah,
[01:01:23] [speaker-2] I have like an hour.
[01:01:24] [speaker-2] Yeah,
[01:01:25] [speaker-2] so I'm good.
[01:01:26] [speaker-1] Okay,
[01:01:28] [speaker-3] cool.
[01:01:28] [speaker-3] Nice.
[01:01:28] [speaker-3] All right.
[01:01:29] [speaker-3] Thank you so much.
[01:01:30] [speaker-3] Appreciate everybody coming up here talking,
[01:01:33] [speaker-3] Mishko.
[01:01:33] [speaker-3] Thanks for joining us today.
[01:01:34] [speaker-3] It's been fantastic so far,
[01:01:36] [speaker-3] and I'm sure it will continue to be that.
[01:01:39] [speaker-3] Oh man,
[01:01:39] [speaker-3] this has been some great conversation.
[01:01:40] [speaker-3] Just sitting here listening to everybody has been so fulfilling.
[01:01:43] [speaker-3] So thank you for everybody.
[01:01:46] [speaker-3] By the way,
[01:01:46] [speaker-3] anybody that's up here,
[01:01:47] [speaker-3] that's come up here,
[01:01:48] [speaker-3] and maybe they're not on the stage anymore.
[01:01:50] [speaker-3] Either way,
[01:01:51] [speaker-3] if you've gotten value from them,
[01:01:52] [speaker-3] please click on their face there.
[01:01:54] [speaker-3] Be sure to follow them because I guarantee you,
[01:01:56] [speaker-3] if you've gotten value from them here.
[01:01:58] [speaker-3] Then you will probably get value from them in other places.
[01:02:01] [speaker-3] So be sure to do that.
[01:02:02] [speaker-3] And hey,
[01:02:02] [speaker-3] you know what?
[01:02:03] [speaker-3] If you want to give JavaScript GM a little follow,
[01:02:05] [speaker-3] we wouldn't mind that either.
[01:02:07] [speaker-3] By the way,
[01:02:07] [speaker-3] if you're not already part of our JavaScript GM newsletter and receiving that in your inbox and getting all that awesome value that Anthony writes up every week,
[01:02:15] [speaker-3] you're missing out.
[01:02:16] [speaker-3] You need to go and subscribe to that guy and get that coming to your inbox so that you can keep up with the things going on in the world without having to.
[01:02:26] [speaker-3] In the world of web dev and JavaScript,
[01:02:27] [speaker-3] that is,
[01:02:28] [speaker-3] without having to really search around too much,
[01:02:32] [speaker-3] we kind of send it right to you.
[01:02:33] [speaker-3] So,
[01:02:34] [speaker-3] not just that,
[01:02:34] [speaker-3] it's usually things that we'll be talking about in our Wednesday talks.
[01:02:38] [speaker-3] So,
[01:02:39] [speaker-3] feel free to go there and download or subscribe,
[01:02:44] [speaker-3] and we can go from there.
[01:02:46] [speaker-3] Anyway,
[01:02:47] [speaker-3] thank you all so much.
[01:02:48] [speaker-3] Greatly appreciate it.
[01:02:49] [speaker-3] Remember this as well:
[01:02:51] [speaker-3] if you are a beginner or you're an advanced lifelong learner up here.
[01:02:55] [speaker-3] It doesn't matter.
[01:02:56] [speaker-3] We love to hear from everybody,
[01:02:57] [speaker-3] so feel free to request to come up,
[01:02:59] [speaker-3] and we'll bring you up on stage.
[01:03:01] [speaker-3] You can ask question,
[01:03:02] [speaker-3] comment,
[01:03:03] [speaker-3] concern,
[01:03:04] [speaker-3] fact,
[01:03:04] [speaker-3] statement,
[01:03:05] [speaker-3] opinion,
[01:03:05] [speaker-3] whatever.
[01:03:06] [speaker-3] We'd love to hear from you.
[01:03:08] [speaker-3] All right.
[01:03:09] [speaker-3] Thank y'all so much.
[01:03:10] [speaker-3] And back to you,
[01:03:12] [speaker-3] Anthony.
[01:03:13] [speaker-1] Yeah.
[01:03:13] [speaker-1] And if people are interested in quick,
[01:03:16] [speaker-1] you know,
[01:03:17] [speaker-1] these kind of frameworks,
[01:03:17] [speaker-1] then that's really the type of stuff we cover in the newsletter of links to a bunch of.
[01:03:24] [speaker-1] Mishko's blog posts and podcast interviews and things like that.
[01:03:28] [speaker-1] We also give you a rundown of the weekly podcast episodes.
[01:03:34] [speaker-1] So,
[01:03:34] [speaker-3] looks like I think Mishko kind of dropped out,
[01:03:36] [speaker-3] and then I yeah,
[01:03:38] [speaker-1] so I invited back up,
[01:03:39] [speaker-1] back up right now.
[01:03:42] [speaker-1] Cool,
[01:03:43] [speaker-1] Dev.
[01:03:43] [speaker-1] I am curious.
[01:03:44] [speaker-1] Oh wait,
[01:03:44] [speaker-1] Dev actually is back down as listener as well.
[01:03:47] [speaker-1] So,
[01:03:47] [speaker-1] raise.
[01:03:49] [speaker-1] What's up?
[01:03:50] [speaker-4] Yeah,
[01:03:50] [speaker-4] I was just just going to bring it to.
[01:03:53] [speaker-4] To build the
[01:03:54] [speaker-4] I/O, and you know,
[01:03:56] [speaker-4] just just for context,
[01:03:57] [speaker-4] as I mentioned,
[01:03:57] [speaker-4] I'm I'm the product manager for GeoSites,
[01:03:59] [speaker-4] which is a platform for building and running
[01:04:04] [speaker-4] JavaScript websites.
[01:04:07] [speaker-4] And one of the things we are actually considering is we have a an old framework called
[01:04:15] [speaker-4] React Storefront,
[01:04:17] [speaker-4] and it was an e-commerce web development framework.
[01:04:21] [speaker-4] From from a couple of years ago,
[01:04:23] [speaker-4] that hasn't been maintained yet,
[01:04:25] [speaker-4] and we are we are considering writing that in in quick to solve these kind of performance problems that are that are so common,
[01:04:34] [speaker-4] especially in e commerce websites,
[01:04:36] [speaker-4] large e commerce websites,
[01:04:38] [speaker-4] and then integrating it with something like something like Builder IO.
[01:04:43] [speaker-4] So I am just wondering,
[01:04:44] [speaker-4] like,
[01:04:44] [speaker-4] how do you do you have projects like that already?
[01:04:50] [speaker-4] You know,
[01:04:51] [speaker-4] in in your that you are aware of that maybe we can learn something from,
[01:04:55] [speaker-4] or would you be like,
[01:04:57] [speaker-4] how does how does this sound to you?
[01:04:59] [speaker-4] Would would you be interested in in collaborating?
[01:05:02] [speaker-4] If I plug plug myself in a little bit,
[01:05:06] [speaker-2] yeah,
[01:05:06] [speaker-2] absolutely.
[01:05:07] [speaker-2] Actually,
[01:05:08] [speaker-2] we do have something similar already.
[01:05:09] [speaker-2] So first of all,
[01:05:10] [speaker-2] we have a Discord channel,
[01:05:12] [speaker-2] and people who are actually building website,
[01:05:14] [speaker-2] we kind of have that have reached out to us,
[01:05:16] [speaker-2] and they want to collaborate like that.
[01:05:18] [speaker-2] We actually have.
[01:05:19] [speaker-2] The channels where we kind of help them out,
[01:05:20] [speaker-2] etc.
[01:05:21] [speaker-2] There is a company that actually selling sporting goods,
[01:05:24] [speaker-2] and I can't remember the name of it right now.
[01:05:26] [speaker-2] And they're doing something very similar,
[01:05:28] [speaker-2] as you're pointing it out.
[01:05:30] [speaker-2] And they're rebuilding their e-commerce website in in Quick,
[01:05:36] [speaker-2] and so they're having a pretty good experience.
[01:05:37] [speaker-2] And you know,
[01:05:38] [speaker-2] when things arise,
[01:05:39] [speaker-2] they they reach out to us,
[01:05:40] [speaker-2] and we help them out.
[01:05:41] [speaker-2] So yeah,
[01:05:41] [speaker-2] reach out to me on Discord,
[01:05:42] [speaker-2] and I'm happy to set something up.
[01:05:45] [speaker-4] Excellent.
[01:05:45] [speaker-4] Thank you.
[01:05:51] [speaker-1] Yeah,
[01:05:51] [speaker-1] do you want to talk about the kind of quick community at all?
[01:05:57] [speaker-2] Yeah,
[01:05:57] [speaker-2] we can talk about the community.
[01:05:58] [speaker-2] Yeah,
[01:05:59] [speaker-2] so very proud of the community.
[01:06:01] [speaker-2] They are.
[01:06:03] [speaker-2] I think we're now the Discord channel is about five thousand strong.
[01:06:09] [speaker-2] We have what we call quick heroes,
[01:06:11] [speaker-2] which are a bunch of people who have been with us for a while,
[01:06:14] [speaker-2] and they're super helpful on going around and answering other people's questions.
[01:06:18] [speaker-2] And providing feedback and building cool things.
[01:06:21] [speaker-2] So yeah,
[01:06:21] [speaker-2] I think Discord is a is a good place to start.
[01:06:24] [speaker-2] And as a beginner,
[01:06:25] [speaker-2] you can get lots of questions answered over there for us.
[01:06:29] [speaker-2] And yeah,
[01:06:31] [speaker-2] we're trying to make it you know easier every day.
[01:06:33] [speaker-2] Right now,
[01:06:33] [speaker-2] we're focusing,
[01:06:34] [speaker-2] as I said,
[01:06:35] [speaker-2] for documentation to get it before one point zero,
[01:06:38] [speaker-2] and kind of a revamp on everything.
[01:06:40] [speaker-2] But yeah,
[01:06:45] [speaker-1] sweet.
[01:06:46] [speaker-1] Open floor right now to any of the speakers on the stage.
[01:06:49] [speaker-1] Anyone has questions,
[01:06:50] [speaker-1] feel free.
[01:06:50] [speaker-1] It could be about quick or anything else.
[01:06:59] [speaker-1] And if there's anything else you want to speak about,
[01:07:01] [speaker-1] media we haven't talked about yet,
[01:07:03] [speaker-1] or things that are coming up,
[01:07:04] [speaker-1] you want people to know about,
[01:07:06] [speaker-1] feel free to do that as well.
[01:07:09] [speaker-2] You know,
[01:07:09] [speaker-2] I
[01:07:10] [speaker-2] I can people don't have questions.
[01:07:11] [speaker-2] I can definitely talk about something.
[01:07:13] [speaker-2] One thing I find interesting,
[01:07:14] [speaker-2] I kind of touched on it earlier.
[01:07:16] [speaker-2] Is that when we talk to other folks who are building websites using Next.js,
[01:07:22] [speaker-2] etc.,
[01:07:23] [speaker-2] there is often like this vocabulary mismatch.
[01:07:26] [speaker-2] Like,
[01:07:26] [speaker-2] for example,
[01:07:27] [speaker-2] we have these dollar signs everywhere,
[01:07:29] [speaker-2] right?
[01:07:29] [speaker-2] And so,
[01:07:29] [speaker-2] when we first try to explain it to people,
[01:07:31] [speaker-2] they're like,
[01:07:32] [speaker-2] "Well,
[01:07:33] [speaker-2] I don't have dollar signs or anything equivalent like that inside of my meta framework.
[01:07:37] [speaker-2] Like,
[01:07:37] [speaker-2] why do you need it?
[01:07:38] [speaker-2] Like,
[01:07:38] [speaker-2] it's kind of hard to wrap my head around it because,
[01:07:41] [speaker-2] like,
[01:07:41] [speaker-2] I was able to build sites without it.
[01:07:43] [speaker-2] So,
[01:07:43] [speaker-2] why is this all of a sudden necessary?"
[01:07:46] [speaker-2] And you know you can build websites without it,
[01:07:50] [speaker-2] right?
[01:07:50] [speaker-2] Like we've been doing it for a while.
[01:07:51] [speaker-2] But this dollar signs gives you a particular value,
[01:07:54] [speaker-2] which is like,
[01:07:55] [speaker-2] hey,
[01:07:55] [speaker-2] you need to you get entry points into your system,
[01:07:58] [speaker-2] and then people,
[01:07:58] [speaker-2] of course,
[01:07:59] [speaker-2] are like,
[01:07:59] [speaker-2] well,
[01:07:59] [speaker-2] what do you mean by entry point?
[01:08:00] [speaker-2] Like,
[01:08:01] [speaker-2] again,
[01:08:01] [speaker-2] it's not something that I can relate to because we don't really have the equivalent in it,
[01:08:06] [speaker-2] and so we're just kind of constantly discovering that like it requires a bit of a vocabulary shift.
[01:08:12] [speaker-2] So,
[01:08:12] [speaker-2] for example,
[01:08:13] [speaker-2] why entry points,
[01:08:14] [speaker-2] right?
[01:08:15] [speaker-2] Well,
[01:08:16] [speaker-2] if you want to be resumable,
[01:08:18] [speaker-2] or rather,
[01:08:18] [speaker-2] let's back up a second.
[01:08:19] [speaker-2] What's an entry point for a typical application?
[01:08:21] [speaker-2] Well,
[01:08:22] [speaker-2] there is a—you know—if you have a React application,
[01:08:24] [speaker-2] there is a main bundle somewhere that you load,
[01:08:26] [speaker-2] and that main bundle has a function that essentially calls render function.
[01:08:33] [speaker-2] I forget the latest API in React,
[01:08:35] [speaker-2] but like there's a render that kind of gets invoked,
[01:08:37] [speaker-2] right?
[01:08:38] [speaker-2] And if you think about it,
[01:08:39] [speaker-2] that's the only entry point that's available in your system.
[01:08:42] [speaker-2] I mean,
[01:08:43] [speaker-2] yes.
[01:08:43] [speaker-2] If you have lazy loading,
[01:08:44] [speaker-2] then there's other entry points.
[01:08:46] [speaker-2] But for the most part,
[01:08:47] [speaker-2] the way
[01:08:48] [speaker-2] React gets a hold of all of your application is that it starts at the root and then traverses all the components and gets hold of the listeners,
[01:08:57] [speaker-2] etc.
[01:08:58] [speaker-2] Actually,
[01:08:59] [speaker-2] it's not true just for React; it's true for any existing system,
[01:09:02] [speaker-2] right?
[01:09:02] [speaker-2] Whether it's Angular,
[01:09:03] [speaker-2] Vue,
[01:09:04] [speaker-2] Solid,
[01:09:04] [speaker-2] etc.
[01:09:05] [speaker-2] The way these systems get a hold of everything is that they start at the root and they traverse the components.
[01:09:13] [speaker-2] And so,
[01:09:13] [speaker-2] if you want to have a resumable system,
[01:09:15] [speaker-2] you realize like,
[01:09:15] [speaker-2] well,
[01:09:16] [speaker-2] my entry point cannot be the the root component because if it's the root component,
[01:09:21] [speaker-2] then the only option I have is well,
[01:09:25] [speaker-2] start at the root component and you know traverse all the children and look for everything.
[01:09:30] [speaker-2] And so,
[01:09:30] [speaker-2] you need a way of saying like,
[01:09:32] [speaker-2] I would like to enter the system in other places,
[01:09:35] [speaker-2] not just the root location.
[01:09:36] [speaker-2] And so,
[01:09:37] [speaker-2] Quick has needs to solve the problem of like,
[01:09:40] [speaker-2] how do I create a system where there are
[01:09:42] [speaker-2] Lots and lots of entry points.
[01:09:43] [speaker-2] As a matter of fact,
[01:09:44] [speaker-2] the more the better,
[01:09:45] [speaker-2] and this is where the dollar sign comes in,
[01:09:47] [speaker-2] right?
[01:09:47] [speaker-2] Really,
[01:09:47] [speaker-2] what dollar sign is,
[01:09:50] [speaker-2] is a way to get more entries into the system,
[01:09:52] [speaker-2] so that when you render a simple counter with a plus button and a minus button,
[01:09:59] [speaker-2] you know,
[01:09:59] [speaker-2] clicking on plus is a different entry into the system than clicking on the minus,
[01:10:04] [speaker-2] because you know,
[01:10:05] [speaker-2] one you know runs code to increment,
[01:10:07] [speaker-2] one runs code to decrement,
[01:10:10] [speaker-2] and so you don't necessarily need to have both of them at
[01:10:11] [speaker-2] Present at the same time,
[01:10:14] [speaker-2] and so like we find that it's really hard to explain to people like why we are doing this,
[01:10:20] [speaker-2] why you have to,
[01:10:21] [speaker-2] why you need this.
[01:10:22] [speaker-2] But like once you understand it,
[01:10:23] [speaker-2] like it just come,
[01:10:25] [speaker-2] you know,
[01:10:26] [speaker-2] you you you get new vocabulary that kind of is important,
[01:10:29] [speaker-2] and then with it come secondary problems like,
[01:10:32] [speaker-2] hey,
[01:10:32] [speaker-2] you know,
[01:10:33] [speaker-2] as you as was kind of pointed out,
[01:10:34] [speaker-2] like we now need to lazy load things.
[01:10:36] [speaker-2] Well,
[01:10:36] [speaker-2] how do we make sure that as a developer you don't have to worry about lazy loading?
[01:10:40] [speaker-2] How do we make sure that you prefetch everything,
[01:10:42] [speaker-2] and so on?
[01:10:43] [speaker-2] And so there's a lot of concepts that just aren't available in in in the other frameworks,
[01:10:48] [speaker-2] and that's what makes it kind of difficult for people to wrap their head around it at the beginning.
[01:10:55] [speaker-1] Yeah,
[01:10:55] [speaker-1] I find that there's always kind of a vocabulary gap once you start crossing over,
[01:11:02] [speaker-1] even if frameworks are ultimately building the same thing at the end of the day.
[01:11:06] [speaker-1] Website,
[01:11:06] [speaker-1] the way they get there can be.
[01:11:09] [speaker-1] Very different and involve different mental models and terminology.
[01:11:13] [speaker-1] You actually wrote a blog post recently,
[01:11:15] [speaker-1] resumability from the ground up.
[01:11:19] [speaker-1] How would you?
[01:11:19] [speaker-1] Do you want to kind of summarize what that blog post goes?
[01:11:22] [speaker-1] Because I feel like this is another word that is like a vocabulary gap.
[01:11:25] [speaker-1] With quick,
[01:11:27] [speaker-2] yeah.
[01:11:27] [speaker-2] So the
[01:11:29] [speaker-2] I recently been writing a lot of these from ground up posts where you know I
[01:11:33] [speaker-2] I basically try to solve a particular problem and kind of take you the reader.
[01:11:38] [speaker-2] Through these steps,
[01:11:39] [speaker-2] as in,
[01:11:39] [speaker-2] like,
[01:11:40] [speaker-2] well,
[01:11:40] [speaker-2] let's say we wanted to do this.
[01:11:41] [speaker-2] You know,
[01:11:41] [speaker-2] what kind of issues?
[01:11:42] [speaker-2] I've really liked them.
[01:11:43] [speaker-1] There's been really good blogging on.
[01:11:45] [speaker-1] Oh,
[01:11:45] [speaker-1] thank you,
[01:11:46] [speaker-1] thank you.
[01:11:46] [speaker-2] I appreciate that.
[01:11:48] [speaker-2] So the the idea of reasonability is,
[01:11:50] [speaker-2] you know,
[01:11:51] [speaker-2] what if you didn't want to execute any code at the beginning,
[01:11:53] [speaker-2] right,
[01:11:54] [speaker-2] of your application?
[01:11:56] [speaker-2] What kind of steps would you have to go through?
[01:11:58] [speaker-2] And so what that blog post essentially goes through is like,
[01:12:00] [speaker-2] well,
[01:12:01] [speaker-2] the first thing you need to do is like,
[01:12:02] [speaker-2] okay,
[01:12:02] [speaker-2] so you click on a button.
[01:12:04] [speaker-2] The button is a listener somewhere,
[01:12:06] [speaker-2] right?
[01:12:06] [speaker-2] And the listener is usually buried somewhere deep inside of your JSX.
[01:12:10] [speaker-2] How do you get a hold of it?
[01:12:11] [speaker-2] You know,
[01:12:11] [speaker-2] how do I get a hold of this listener that's that's deep down?
[01:12:15] [speaker-2] And so,
[01:12:16] [speaker-2] let's say you solve that problem.
[01:12:17] [speaker-2] So the next problem you have is like,
[01:12:18] [speaker-2] great.
[01:12:19] [speaker-2] So now you're executing this listener,
[01:12:20] [speaker-2] but this listener has no state,
[01:12:23] [speaker-2] right?
[01:12:23] [speaker-2] It lost all of the information.
[01:12:25] [speaker-2] It's just a code without the state of the system.
[01:12:28] [speaker-2] How does it know what the current value of the counter is?
[01:12:30] [speaker-2] Do I
[01:12:31] [speaker-2] Add one to zero,
[01:12:32] [speaker-2] or ten,
[01:12:32] [speaker-2] or a hundred.
[01:12:33] [speaker-2] Like you know,
[01:12:33] [speaker-2] what what's the current state?
[01:12:35] [speaker-2] And so you have to solve that particular problem.
[01:12:37] [speaker-2] And so you just kind of go through all of these pieces,
[01:12:39] [speaker-2] and you kind of realize,
[01:12:40] [speaker-2] like,
[01:12:41] [speaker-2] hey,
[01:12:41] [speaker-2] you know,
[01:12:42] [speaker-2] all of these things are things that are that need to be solved.
[01:12:46] [speaker-2] But there's no equivalent in other frameworks because,
[01:12:49] [speaker-2] well,
[01:12:49] [speaker-2] other frameworks solve this problem by hydration,
[01:12:51] [speaker-2] and hydration just means just re-execute everything from the beginning.
[01:12:55] [speaker-2] There is no reusability.
[01:12:57] [speaker-2] So yeah,
[01:12:58] [speaker-2] there's a lot of vocabulary.
[01:13:00] [speaker-2] That has to be kind of learned to get there.
[01:13:05] [speaker-1] Very cool.
[01:13:06] [speaker-1] Yeah,
[01:13:06] [speaker-1] I've heard you give that pitch quite a few times now,
[01:13:09] [speaker-1] both interviewing you and listening to other things.
[01:13:12] [speaker-1] And
[01:13:13] [speaker-1] I think it makes sense at this point.
[01:13:14] [speaker-1] Took a while,
[01:13:15] [speaker-1] but seems to be there.
[01:13:16] [speaker-1] Yeah.
[01:13:17] [speaker-2] Also,
[01:13:17] [speaker-2] sorry,
[01:13:17] [speaker-2] I'm going to go off tangent here.
[01:13:18] [speaker-2] I also find it interesting that a lot of people like confuse resumability with like delayed hydration,
[01:13:28] [speaker-2] and the two are.
[01:13:29] [speaker-2] Really different,
[01:13:31] [speaker-2] because in the case of a hydration,
[01:13:33] [speaker-2] you're still doing all the work.
[01:13:35] [speaker-2] You're just arguing about when the work gets done.
[01:13:37] [speaker-2] Is it now or a little bit later,
[01:13:39] [speaker-2] right?
[01:13:40] [speaker-2] Whereas with resumeability,
[01:13:41] [speaker-2] like that work fundamentally isn't there.
[01:13:44] [speaker-2] Like there is no hydration,
[01:13:46] [speaker-2] right?
[01:13:47] [speaker-2] And so,
[01:13:47] [speaker-2] like if you if we talk about hydration,
[01:13:49] [speaker-2] like we need to talk about like,
[01:13:50] [speaker-2] well,
[01:13:50] [speaker-2] what do you?
[01:13:50] [speaker-2] How do we define hydration?
[01:13:52] [speaker-2] And a lot of people tend to define it as like just make the page interactive.
[01:13:56] [speaker-2] But I think that kind of misses the point.
[01:13:58] [speaker-2] The real point of hydration is for the framework to recover its internal state,
[01:14:02] [speaker-2] right?
[01:14:03] [speaker-2] And what I mean by that is,
[01:14:05] [speaker-2] for the framework needs to know where are the component boundaries,
[01:14:08] [speaker-2] where are the listeners,
[01:14:09] [speaker-2] what is the state of the component.
[01:14:10] [speaker-2] If I if this state changes,
[01:14:12] [speaker-2] what other components do I have to re-render,
[01:14:14] [speaker-2] right?
[01:14:15] [speaker-2] This is really what's being rebuilt as part of hydration,
[01:14:19] [speaker-2] and that's the the hard part.
[01:14:21] [speaker-2] The listener part is relatively easy to solve,
[01:14:25] [speaker-2] and also to kind of
[01:14:28] [speaker-2] Get around right?
[01:14:28] [speaker-2] Like yes.
[01:14:29] [speaker-2] At the end of the day,
[01:14:30] [speaker-2] we're doing all this work to make the page interactive,
[01:14:33] [speaker-2] but really,
[01:14:34] [speaker-2] hydration is about recovering that internal state for the framework.
[01:14:38] [speaker-2] And so,
[01:14:38] [speaker-2] the place where kind of Quik I think is unique,
[01:14:42] [speaker-2] is that the Quik doesn't go about it this way.
[01:14:45] [speaker-2] Quik basically said,
[01:14:46] [speaker-2] "Look,
[01:14:47] [speaker-2] I had the state when I did server-side rendering,
[01:14:50] [speaker-2] and therefore,
[01:14:51] [speaker-2] I just need to somehow move that state from the server to the client.
[01:14:54] [speaker-2] So if I
[01:14:55] [speaker-2] Can serialize my state in such a way into HTML that I don't need to rerun any of the components.
[01:15:01] [speaker-2] Then I can just literally resume where I left off.
[01:15:04] [speaker-2] And if you think about it,
[01:15:05] [speaker-2] existing applications already have that,
[01:15:07] [speaker-2] right?
[01:15:07] [speaker-2] Like if you look at Next.js,
[01:15:08] [speaker-2] Next.js takes the state of the application and serializes it into the underscore Next underscore app or something like that.
[01:15:16] [speaker-2] I forget the name of the data that gets serialized inside of the HTML.
[01:15:19] [speaker-2] Right?
[01:15:20] [speaker-2] That's the state of the application,
[01:15:22] [speaker-2] so that your application can just
[01:15:24] [speaker-2] Continue where it left over,
[01:15:26] [speaker-2] like meaning it doesn't have to re-execute fetching of the data,
[01:15:30] [speaker-2] and re-execute you know any anything like that.
[01:15:34] [speaker-2] What's missing is to do the same exact thing,
[01:15:37] [speaker-2] but for the framework,
[01:15:39] [speaker-2] right?
[01:15:39] [speaker-2] And that's the hard part.
[01:15:40] [speaker-2] Is like you cannot reach into your rendering framework and be like,
[01:15:45] [speaker-2] give me your state so that I can serialize it in such a way so that when you wake up you can just continue where you left off.
[01:15:52] [speaker-2] And that's the hard part.
[01:15:52] [speaker-2] That's the thing.
[01:15:54] [speaker-2] That I think is is unique,
[01:15:56] [speaker-2] and it requires kind of getting your head around it and and learning about it.
[01:16:01] [speaker-1] Yeah,
[01:16:01] [speaker-1] that was the very big galaxy brain idea for me.
[01:16:04] [speaker-1] The first time you explained this to me,
[01:16:05] [speaker-1] the state of your app and the state of the frameworks,
[01:16:08] [speaker-1] it had never even occurred to me to to think about that before.
[01:16:12] [speaker-1] Because I'm someone who has used so many frameworks,
[01:16:14] [speaker-1] and for the most part,
[01:16:15] [speaker-1] can get them to work and do what I need them to do without needing to know too much of the internals.
[01:16:20] [speaker-1] But um.
[01:16:22] [speaker-1] Eventually,
[01:16:22] [speaker-1] yeah,
[01:16:22] [speaker-1] but like you have to actually learn that.
[01:16:25] [speaker-2] If you look at two two different kinds of frameworks,
[01:16:26] [speaker-2] like let's say you're in React and then you want to go to Swell,
[01:16:29] [speaker-2] right?
[01:16:30] [speaker-2] They they fundamentally work very similarly,
[01:16:32] [speaker-2] and so while you might need to learn new concepts,
[01:16:36] [speaker-2] it's relatively,
[01:16:37] [speaker-2] I would say,
[01:16:37] [speaker-2] straightforward because these concepts map one to one.
[01:16:40] [speaker-2] Like,
[01:16:40] [speaker-2] how do I get a hide or show a component?
[01:16:44] [speaker-2] Well,
[01:16:44] [speaker-2] in React,
[01:16:45] [speaker-2] you use this.
[01:16:46] [speaker-2] In Swell,
[01:16:46] [speaker-2] you do this,
[01:16:47] [speaker-2] and so you have like this mental mapping between the two things,
[01:16:50] [speaker-2] right?
[01:16:51] [speaker-2] That exists.
[01:16:53] [speaker-2] Whereas,
[01:16:53] [speaker-2] you know,
[01:16:54] [speaker-2] if you come to it from too quick,
[01:16:56] [speaker-2] sure,
[01:16:56] [speaker-2] we have the mental mapping of like how do you hide something,
[01:16:59] [speaker-2] how do you show something.
[01:17:00] [speaker-2] But then when you start talking about resumability,
[01:17:02] [speaker-2] it's like
[01:17:03] [speaker-2] I don't have an equivalent thing on the other side.
[01:17:06] [speaker-2] And so,
[01:17:06] [speaker-2] like,
[01:17:07] [speaker-2] what are you talking about?
[01:17:07] [speaker-2] I'm kind of confused,
[01:17:08] [speaker-2] right?
[01:17:09] [speaker-2] And this is the part that that is hard.
[01:17:11] [speaker-2] And and so what typically happens is people say like,
[01:17:14] [speaker-2] well,
[01:17:15] [speaker-2] I don't understand what you mean by resumability,
[01:17:17] [speaker-2] but I have this other thing called hydration.
[01:17:18] [speaker-2] So I think you just mean hydration.
[01:17:20] [speaker-2] Right,
[01:17:20] [speaker-2] and so they they desperately try to like bring you back into this thing,
[01:17:24] [speaker-2] and then you're like,
[01:17:25] [speaker-2] well,
[01:17:25] [speaker-2] no,
[01:17:26] [speaker-2] it's not hydration because like what hydration does is essentially booting up your framework.
[01:17:33] [speaker-2] Right,
[01:17:33] [speaker-2] it's executing all the code so that you can boot up your system,
[01:17:37] [speaker-2] and that bit is the bit that's kind of skipped.
[01:17:40] [speaker-2] Well,
[01:17:40] [speaker-2] I think we do this.
[01:17:42] [speaker-1] We do this in tech when we compare things,
[01:17:44] [speaker-1] which is.
[01:17:44] [speaker-1] We can compare two things because they're trying to solve the same problem,
[01:17:48] [speaker-1] and we can compare two things because they're actually similar to each other.
[01:17:51] [speaker-1] This happened with Redwood and Blitz.
[01:17:53] [speaker-1] Everyone would always bundle them together and be like,
[01:17:55] [speaker-1] "Yeah,
[01:17:55] [speaker-1] these two full stack frameworks with React,
[01:17:58] [speaker-1] and they're totally different how they worked architecturally internally,
[01:18:02] [speaker-1] but they always got kind of bundled together."
[01:18:04] [speaker-1] And so it's like you hear this one thing,
[01:18:05] [speaker-1] it triggers this other idea in your brain,
[01:18:07] [speaker-1] and so but you have to actually think,
[01:18:09] [speaker-1] "Wait,
[01:18:10] [speaker-1] these are not the same thing.
[01:18:11] [speaker-1] They're two different things.
[01:18:11] [speaker-1] So what's the difference?"
[01:18:13] [speaker-2] Yes.
[01:18:14] [speaker-2] Yes,
[01:18:14] [speaker-2] that's right.
[01:18:16] [speaker-1] Cool.
[01:18:17] [speaker-1] We got someone else hop up here,
[01:18:18] [speaker-1] Farid.
[01:18:19] [speaker-2] Yep.
[01:18:20] [speaker-3] Yep.
[01:18:21] [speaker-3] Hi,
[01:18:21] [speaker-3] everyone.
[01:18:22] [speaker-3] Hi,
[01:18:22] [speaker-3] Mishko.
[01:18:23] [speaker-3] I've had asked question a couple of times before from Mishko about the quick.
[01:18:27] [speaker-3] So I have one new one in terms of the resumability.
[01:18:30] [speaker-3] I was wondering that since you're serializing the closure,
[01:18:35] [speaker-3] for that matter,
[01:18:37] [speaker-3] is there any specific limitation on that serialization and like
[01:18:43] [speaker-3] Do you care about the data types that are available in the closure that's supposed to be serialized and reused again once the app is supposed to resume from that entry point?
[01:18:55] [speaker-3] And the other question would be:
[01:18:59] [speaker-3] Is there any process like a garbage collection or anything like that running in the quick to sort of unhook the closures that are not being used anymore?
[01:19:11] [speaker-2] Ah,
[01:19:12] [speaker-2] the good questions.
[01:19:13] [speaker-2] Um.
[01:19:14] [speaker-2] So the short answer is that you the closure can close over anything that the systems know how to serialize.
[01:19:20] [speaker-2] So obviously all the JSON type we know how to serialize,
[01:19:23] [speaker-2] but we can also serialize promises,
[01:19:25] [speaker-2] maps,
[01:19:25] [speaker-2] sets,
[01:19:26] [speaker-2] and of course other closures.
[01:19:28] [speaker-2] Um.
[01:19:29] [speaker-2] So anything that's serializable is something the closure can close over,
[01:19:34] [speaker-2] and it will just work.
[01:19:35] [speaker-2] And so this gets this is nice because closures can close over other closures,
[01:19:38] [speaker-2] which then in turn can close over other things,
[01:19:40] [speaker-2] and so on.
[01:19:41] [speaker-2] The thing that's hard about serializing
[01:19:42] [speaker-2] Enclosure is that you need to separate out the the JavaScript the behavior from the state,
[01:19:50] [speaker-2] right?
[01:19:50] [speaker-2] And so these two pieces of data need to be shipped into separate locations.
[01:19:57] [speaker-2] Right,
[01:19:57] [speaker-2] one goes into the bundler,
[01:19:59] [speaker-2] and the other one gets placed inside of your kind of the the JSON serialized state object,
[01:20:05] [speaker-2] and then the system then needs to put everything back together.
[01:20:08] [speaker-2] And what gets even trippier is that.
[01:20:10] [speaker-2] Let's say you're using server dollar sign.
[01:20:13] [speaker-2] Well,
[01:20:14] [speaker-2] in that case,
[01:20:14] [speaker-2] you have a you know you know what your code is right.
[01:20:18] [speaker-2] That's just JavaScript that's available to you,
[01:20:20] [speaker-2] and then you know what variables you closed over.
[01:20:23] [speaker-2] But now you have to ship that information to the server.
[01:20:26] [speaker-2] Except server,
[01:20:28] [speaker-2] you know,
[01:20:28] [speaker-2] client is running
[01:20:30] [speaker-2] ESM, but the server is running CJS.
[01:20:33] [speaker-2] So you can't just like use the same exact code that the client had because that's not going to work.
[01:20:38] [speaker-2] So you also have to do a little bit of a mapping and be like,
[01:20:40] [speaker-2] oh right,
[01:20:40] [speaker-2] right.
[01:20:40] [speaker-2] So that closure is actually the equivalent CJS code over here.
[01:20:44] [speaker-2] So let me execute that code instead,
[01:20:46] [speaker-2] and then you have to put the data back into the closure,
[01:20:48] [speaker-2] kind of make it work again.
[01:20:49] [speaker-2] So there's lots of interesting trickery that has to happen in order to make this available,
[01:20:53] [speaker-2] but I think the payback is really,
[01:20:55] [speaker-2] really nice.
[01:20:57] [speaker-2] One of my favorite ways of of kind of seeing how you get a payback is that it you know,
[01:21:03] [speaker-2] in most frameworks,
[01:21:05] [speaker-2] if you say like,
[01:21:06] [speaker-2] hey.
[01:21:06] [speaker-2] I need to listen to a scroll.
[01:21:07] [speaker-2] Let's say I need to listen to a scroll event.
[01:21:10] [speaker-2] The idea that you could set up the listener for the scroll event on a server,
[01:21:14] [speaker-2] and then execute the scroll event on the client makes no sense.
[01:21:17] [speaker-2] Like,
[01:21:17] [speaker-2] what are you talking about?
[01:21:18] [speaker-2] Of course,
[01:21:18] [speaker-2] I have to wait until I am on the client,
[01:21:22] [speaker-2] and only then can I actually call add event listener to kind of set up a listener for the scrolling,
[01:21:27] [speaker-2] right?
[01:21:28] [speaker-2] But what this closure trickery allows you to do is to basically let's say,
[01:21:31] [speaker-2] actually,
[01:21:31] [speaker-2] no,
[01:21:32] [speaker-2] you can in on a server.
[01:21:34] [speaker-2] Before you even have a browser or DOM or anything,
[01:21:37] [speaker-2] you can execute the equivalent of add event listener and set up say like,
[01:21:41] [speaker-2] "Hey,
[01:21:41] [speaker-2] I'm interested in listening to this thing."
[01:21:44] [speaker-2] But then on the client,
[01:21:45] [speaker-2] you don't actually have to do that.
[01:21:46] [speaker-2] You can just continue running the execution of the of the listener.
[01:21:51] [speaker-2] And so I think that's that's the goal,
[01:21:53] [speaker-2] the the end goal that you're you're going after is that you can essentially skip all the ad event listeners that need to happen on a client.
[01:22:00] [speaker-2] And it's interesting because it is one of the biggest.
[01:22:04] [speaker-2] Gotchas we actually found in Quic is that people who come to Quic from other places,
[01:22:10] [speaker-2] they immediately kind of gravitate to their old ways of doing things.
[01:22:13] [speaker-2] And so,
[01:22:13] [speaker-2] if they want to set up a scroll listener,
[01:22:15] [speaker-2] they immediately say like,
[01:22:17] [speaker-2] "Okay,
[01:22:17] [speaker-2] run code eagerly on the client so that I can execute add event listener and register the closure."
[01:22:23] [speaker-2] And then we have to be like,
[01:22:23] [speaker-2] "No,
[01:22:23] [speaker-2] no,
[01:22:23] [speaker-2] no,
[01:22:24] [speaker-2] no!
[01:22:24] [speaker-2] You're you're missing the point here.
[01:22:25] [speaker-2] You actually want to execute this code in a server,
[01:22:28] [speaker-2] and then have the closure only materialize if somebody actually does the scrolling."
[01:22:35] [speaker-4] So in this case,
[01:22:36] [speaker-4] is the is the um the compiler?
[01:22:39] [speaker-4] I guess is it looking at all the event listener calls and then instructing the framework to to basically invoke them when when that event happens?
[01:22:52] [speaker-4] Like how how how does that actually work?
[01:22:55] [speaker-2] Yeah,
[01:22:55] [speaker-2] yeah.
[01:22:55] [speaker-2] So this is where the quick loader comes in.
[01:22:57] [speaker-2] Actually,
[01:22:57] [speaker-2] um,
[01:22:58] [speaker-2] the answer is you cannot use add event listener.
[01:23:01] [speaker-2] Like the add event listener is kind of your enemy.
[01:23:03] [speaker-2] And so you need to be able to design a system without it.
[01:23:06] [speaker-2] And so the way we get around this particular problem is that the only place where the listener,
[01:23:12] [speaker-2] the ad event listener,
[01:23:13] [speaker-2] exists,
[01:23:14] [speaker-2] is inside of a quick loader.
[01:23:15] [speaker-2] So quick loader is this piece of code that eagerly executes at the beginning,
[01:23:19] [speaker-2] and sets up a global listeners and relies on the fact that browser events bubble.
[01:23:25] [speaker-2] Right.
[01:23:25] [speaker-2] So if the system notices that somebody is interested in scroll events,
[01:23:29] [speaker-2] then it kind of notifies the quick event listener.
[01:23:32] [speaker-2] To a quick loader,
[01:23:33] [speaker-2] saying like,
[01:23:33] [speaker-2] "Hey,
[01:23:33] [speaker-2] by the way,
[01:23:34] [speaker-2] I need to know about the scroll events."
[01:23:36] [speaker-2] And so the the quick loader sets up a global listener for all scroll events.
[01:23:40] [speaker-2] And then when the event happens,
[01:23:43] [speaker-2] the quick loader tries to figure out.
[01:23:44] [speaker-2] So the event happened.
[01:23:46] [speaker-2] Let me go back to where the event originated from and see if I can find a special attribute that tells me which closure I have to execute.
[01:23:57] [speaker-2] And if it finds that information,
[01:23:58] [speaker-2] right,
[01:23:58] [speaker-2] then it actually executes the closure.
[01:24:00] [speaker-2] So the end effect is as if you executed add event listener on a server.
[01:24:06] [speaker-2] That's kind of how it looks like to you as a developer.
[01:24:09] [speaker-2] But of course,
[01:24:10] [speaker-2] in practice,
[01:24:10] [speaker-2] what it just means is that we kind of just delayed it and did it on the client.
[01:24:14] [speaker-2] But we also did it in a way where we don't have to.
[01:24:18] [speaker-2] You know,
[01:24:20] [speaker-2] normally if you have ten buttons and you set up a ten on clicks,
[01:24:24] [speaker-2] then you have to call add event listener ten times,
[01:24:26] [speaker-2] right?
[01:24:27] [speaker-2] But with Quick.
[01:24:28] [speaker-2] In the quick loader,
[01:24:28] [speaker-2] you only set up a single ad event listener in the root for all click-based events for the system.
[01:24:38] [speaker-4] That's very interesting.
[01:24:39] [speaker-4] It seems like you know,
[01:24:40] [speaker-4] you know,
[01:24:41] [speaker-4] you hear about these conspiracy conspiracy theories that all the technical technological advancements are happening because you know some government has the alien technology hidden somewhere,
[01:24:53] [speaker-4] and they're just copying that alien technology.
[01:24:55] [speaker-1] It was because zero interest rates.
[01:24:58] [speaker-1] Yeah.
[01:24:59] [speaker-4] So you know,
[01:25:00] [speaker-4] this it seems like you you you found the perfect architecture in all of these cases,
[01:25:06] [speaker-4] and you're just you know checking the things off the list.
[01:25:09] [speaker-4] Like you know,
[01:25:10] [speaker-4] this is the way to do that,
[01:25:11] [speaker-4] and you know,
[01:25:12] [speaker-4] that's that's very inspiring.
[01:25:14] [speaker-4] The other way,
[01:25:16] [speaker-4] this kind of reminds me of another problem that I've been thinking about,
[01:25:19] [speaker-4] and I don't understand this.
[01:25:20] [speaker-4] Is when you're using signals.
[01:25:27] [speaker-4] The the re-rendering happens much less because supposedly the the way the signals change is different from the way use use state changes in React.
[01:25:41] [speaker-4] So I was just wondering,
[01:25:43] [speaker-4] like there's there's very similar primitives in Quick as well where you can use there's a primitive called use store I think and then
[01:25:53] [speaker-4] React has a use state and they
[01:25:56] [speaker-4] Seem to work the same way.
[01:25:58] [speaker-4] How is it that one of them can can result in less amount of re-rendering and the other one doesn't?
[01:26:07] [speaker-2] Yeah.
[01:26:08] [speaker-2] So the the difference is kind of subtle,
[01:26:10] [speaker-2] but it's super important.
[01:26:12] [speaker-2] And the difference is that if you look at it the way React does it,
[01:26:17] [speaker-2] React is unable to observe where the state is being used.
[01:26:23] [speaker-2] Right.
[01:26:23] [speaker-2] Like once you call use state.
[01:26:25] [speaker-2] The use state returns to you a value,
[01:26:29] [speaker-2] and the moment the React returns the value,
[01:26:31] [speaker-2] React fails to have any form of observability into like what are you going to do with it,
[01:26:38] [speaker-2] whether you throw the value away,
[01:26:40] [speaker-2] or you pass it to a bunch of other components,
[01:26:43] [speaker-2] or you use it internally just inside of your component.
[01:26:46] [speaker-2] There is no way for React to know that information.
[01:26:49] [speaker-2] Right,
[01:26:49] [speaker-2] that information is just forever lost,
[01:26:52] [speaker-2] and because it's lost.
[01:26:54] [speaker-2] React can only do the next obvious thing,
[01:26:57] [speaker-2] which is just re-render everything.
[01:26:59] [speaker-2] That's why it's coarse-grain reactive.
[01:27:01] [speaker-2] So what signals and store and store is kind of just a slightly different signal.
[01:27:08] [speaker-2] What they allow you to do is that when you get back the the value from the use signal or use store,
[01:27:16] [speaker-2] you don't actually get back the value directly.
[01:27:19] [speaker-2] You instead you get a wrapper.
[01:27:21] [speaker-2] And this wrapper comes either in the form of a proxy or a getter and a setter.
[01:27:25] [speaker-2] There's a lot of different kind of variations on this particular thing.
[01:27:29] [speaker-2] Solid JS has getters and setters.
[01:27:32] [speaker-2] MobX has proxies.
[01:27:35] [speaker-2] I think Vue has proxies as well.
[01:27:38] [speaker-2] And so what these proxies allow you to do is that ah that they basically decouple returning the the the the proxy from returning the value.
[01:27:50] [speaker-2] So now.
[01:27:51] [speaker-2] The framework knows when you're actually getting hold of the value.
[01:27:54] [speaker-2] So when you want to get a hold of the value,
[01:27:56] [speaker-2] you have to either call a call getter property,
[01:27:59] [speaker-2] or you invoke the getter,
[01:28:01] [speaker-2] or or do something,
[01:28:02] [speaker-2] and that action of something is information to the framework.
[01:28:07] [speaker-2] And so the framework then is able to make a basically a subscription,
[01:28:12] [speaker-2] basically make a mark that says,
[01:28:13] [speaker-2] "Aha,
[01:28:14] [speaker-2] I know that this value has been used here,
[01:28:17] [speaker-2] here,
[01:28:17] [speaker-2] here,
[01:28:18] [speaker-2] and there,"
[01:28:19] [speaker-2] right?
[01:28:20] [speaker-2] And so it stores this information in such a way that if that value changes in the future,
[01:28:26] [speaker-2] that's easy.
[01:28:26] [speaker-2] Like you know,
[01:28:27] [speaker-2] React knows that because you called that state,
[01:28:29] [speaker-2] or so.
[01:28:30] [speaker-2] You know,
[01:28:30] [speaker-2] all the other signal systems that have a some similar way of kind of mutating the value.
[01:28:34] [speaker-2] So when the value mutates,
[01:28:36] [speaker-2] now the system knows.
[01:28:38] [speaker-2] Okay,
[01:28:39] [speaker-2] I know who to notify to update.
[01:28:41] [speaker-2] Whereas React or a coarse grain system,
[01:28:43] [speaker-2] also Angular falls into this category as well.
[01:28:45] [speaker-2] Well,
[01:28:46] [speaker-2] now Angular has signals,
[01:28:47] [speaker-2] but before signals in Angular,
[01:28:48] [speaker-2] right?
[01:28:50] [speaker-2] The framework would be just like I have no idea.
[01:28:52] [speaker-2] I the only reasonable thing to do is to re-render the whole world.
[01:28:57] [speaker-4] I see,
[01:28:58] [speaker-4] and as I understand it,
[01:29:00] [speaker-4] so the the magic is happening at the compiler,
[01:29:04] [speaker-4] looking at the usage of the value,
[01:29:07] [speaker-4] and then no,
[01:29:09] [speaker-2] the magic happens at runtime.
[01:29:11] [speaker-4] So it's happening at the render.
[01:29:13] [speaker-4] So my question is,
[01:29:15] [speaker-4] like,
[01:29:15] [speaker-4] can we can we add signals to the React?
[01:29:18] [speaker-4] Is is is a question?
[01:29:20] [speaker-2] Um.
[01:29:22] [speaker-2] Yes and no.
[01:29:23] [speaker-2] So yes,
[01:29:24] [speaker-2] because kind of preact already did it,
[01:29:26] [speaker-2] right?
[01:29:26] [speaker-2] So that definitely can be added.
[01:29:29] [speaker-2] Um,
[01:29:30] [speaker-2] but it's it's uh,
[01:29:34] [speaker-2] it requires a slight changes in the way you think about the problem.
[01:29:37] [speaker-2] And the the question really isn't about like can you add signals to react.
[01:29:42] [speaker-2] It's more like if we add signals to react,
[01:29:46] [speaker-2] are we willing to change
[01:29:49] [speaker-2] The developer's mental model of what React is,
[01:29:53] [speaker-2] right?
[01:29:53] [speaker-4] I see.
[01:29:54] [speaker-2] And so the the issue isn't so much as in a technical issue,
[01:29:58] [speaker-2] as in that doing so,
[01:30:01] [speaker-2] you are asking the developers to think about the problem differently.
[01:30:05] [speaker-2] And is that different way of thinking about it?
[01:30:07] [speaker-2] Is it React?
[01:30:08] [speaker-2] Like for React,
[01:30:09] [speaker-2] for example,
[01:30:09] [speaker-2] really,
[01:30:10] [speaker-2] really prides itself on the idea of pure functions,
[01:30:14] [speaker-2] right?
[01:30:14] [speaker-2] Like it's just a bunch of functions that you call in any order you want,
[01:30:17] [speaker-2] and it just kind of works,
[01:30:18] [speaker-2] right?
[01:30:18] [speaker-2] That's kind of their identity,
[01:30:20] [speaker-2] and with signals,
[01:30:21] [speaker-2] that identity changes slightly.
[01:30:22] [speaker-2] And so,
[01:30:23] [speaker-2] the question that becomes like,
[01:30:25] [speaker-2] is that the identity that the core React team,
[01:30:29] [speaker-2] you know,
[01:30:29] [speaker-2] wants for its its goals?
[01:30:33] [speaker-4] I see,
[01:30:33] [speaker-4] I see.
[01:30:35] [speaker-2] But signals are also kind of like I mentioned are kind of a prerequisite for resumability,
[01:30:42] [speaker-2] because you know,
[01:30:44] [speaker-2] as I said,
[01:30:44] [speaker-2] like you could in theory resume something like React.
[01:30:49] [speaker-2] But the problem you would have is that the moment something would change,
[01:30:52] [speaker-2] you would be forced to download and re-execute the whole application,
[01:30:57] [speaker-2] right?
[01:30:57] [speaker-2] And so it's it's almost like you work so hard to get resumability only to like lose it the last inch of the way.
[01:31:06] [speaker-4] I see because because you're not shipping the closure to to the front end,
[01:31:12] [speaker-4] you're just shipping the result or a kind of executed function.
[01:31:18] [speaker-4] Well,
[01:31:18] [speaker-4] no.
[01:31:19] [speaker-2] So,
[01:31:19] [speaker-2] so resumeability makes sense only if you can guarantee that the amount of code that you're going to have to lazy execute is not too much,
[01:31:29] [speaker-2] right?
[01:31:30] [speaker-2] And so,
[01:31:30] [speaker-2] if if the first interaction basically says that I need to download the whole codebase and execute the whole codebase,
[01:31:37] [speaker-2] then it's like,
[01:31:38] [speaker-2] well,
[01:31:38] [speaker-2] why do this work to delay it?
[01:31:40] [speaker-2] Like,
[01:31:41] [speaker-2] you're not really gaining anything,
[01:31:43] [speaker-2] right?
[01:31:43] [speaker-2] And so,
[01:31:44] [speaker-2] resumeability has like a strong preference.
[01:31:47] [speaker-2] For fine-grained systems.
[01:31:50] [speaker-4] I see.
[01:31:50] [speaker-4] Yeah,
[01:31:53] [speaker-4] thank you,
[01:31:54] [speaker-4] thank you for that.
[01:31:58] [speaker-2] You know,
[01:31:58] [speaker-2] you asked me like,
[01:31:59] [speaker-2] is this alien technology?
[01:32:00] [speaker-2] Um,
[01:32:01] [speaker-2] no,
[01:32:01] [speaker-2] it's not.
[01:32:03] [speaker-2] But the way way I think about this particular problem is that,
[01:32:07] [speaker-2] you know,
[01:32:07] [speaker-2] you set a goal for yourself,
[01:32:09] [speaker-2] and for the case of a quick,
[01:32:11] [speaker-2] the goal is very simple,
[01:32:12] [speaker-2] which was delay execution of the code.
[01:32:16] [speaker-2] And so then you can ask yourself,
[01:32:17] [speaker-2] well,
[01:32:18] [speaker-2] how aggressive do you want to be about this goal?
[01:32:21] [speaker-2] And
[01:32:22] [speaker-2] I find that in life,
[01:32:23] [speaker-2] a lot of times it's easier to just pick extremes because then you don't have to like have a debate about it.
[01:32:30] [speaker-2] Like,
[01:32:31] [speaker-2] you either smoke or you don't smoke,
[01:32:34] [speaker-2] right?
[01:32:34] [speaker-2] There is very difficult to be like,
[01:32:36] [speaker-2] I only smoke one cigarette a day,
[01:32:38] [speaker-2] right?
[01:32:40] [speaker-2] So like,
[01:32:40] [speaker-2] it's much easier to be at the extremes.
[01:32:42] [speaker-2] So so when we were when I started working on Quick.
[01:32:45] [speaker-2] My philosophy was very simple,
[01:32:46] [speaker-2] which is like I want to be in a situation where the only time when I download a piece of code is if I execute it,
[01:32:55] [speaker-2] so that I will essentially always be in a situation that if I look at code coverage of my codebase,
[01:33:01] [speaker-2] it should be pretty close to 100 at all times.
[01:33:05] [speaker-2] Right?
[01:33:05] [speaker-2] It seems like a crazy extreme thing,
[01:33:08] [speaker-2] but then you just work backwards from that and you say like,
[01:33:11] [speaker-2] okay,
[01:33:11] [speaker-2] so how do I get there?
[01:33:12] [speaker-2] Like,
[01:33:13] [speaker-2] what do I need to do?
[01:33:14] [speaker-2] In order to get there,
[01:33:15] [speaker-2] and so you kind of come to the conclusion like,
[01:33:16] [speaker-2] well,
[01:33:17] [speaker-2] you need to be able to,
[01:33:18] [speaker-2] you know,
[01:33:19] [speaker-2] start at the listener,
[01:33:20] [speaker-2] right?
[01:33:20] [speaker-2] Like,
[01:33:20] [speaker-2] because the listener,
[01:33:21] [speaker-2] when you click on a,
[01:33:22] [speaker-2] at a button,
[01:33:23] [speaker-2] the first thing that executes is the listener handler.
[01:33:26] [speaker-2] So,
[01:33:27] [speaker-2] you know,
[01:33:27] [speaker-2] how do you get the listener handler?
[01:33:29] [speaker-2] You know,
[01:33:29] [speaker-2] solve that problem.
[01:33:30] [speaker-2] How does the listener get a state?
[01:33:32] [speaker-2] Solve that problem,
[01:33:33] [speaker-2] and then just keep solving it until you either have a moment where like this is impossible,
[01:33:38] [speaker-2] or,
[01:33:39] [speaker-2] you know,
[01:33:39] [speaker-2] you sleep on it and somehow figure out how to get over that problem and keep going.
[01:33:42] [speaker-2] And so.
[01:33:43] [speaker-2] So quick is just kind of the result of that particular point of view,
[01:33:49] [speaker-2] and I'm not saying that your application should only download code when it needs to execute it,
[01:33:54] [speaker-2] but I'm saying is by starting at that point of view,
[01:33:57] [speaker-2] it allows you to build all of these solutions,
[01:34:01] [speaker-2] and then later you can always back off on it.
[01:34:06] [speaker-4] That's very interesting.
[01:34:07] [speaker-4] I guess that that might be you know,
[01:34:10] [speaker-4] if you had started.
[01:34:11] [speaker-4] At solving a different problem,
[01:34:14] [speaker-4] you might have,
[01:34:16] [speaker-4] yeah,
[01:34:16] [speaker-4] you might have arrived at a very different situation,
[01:34:19] [speaker-4] like where instead of having that problem or of only downloading the code that's going to be executed,
[01:34:30] [speaker-4] you try to optimize the way the state works or some other piece of the problem.
[01:34:37] [speaker-4] Essentially,
[01:34:39] [speaker-4] then you would be basically.
[01:34:42] [speaker-4] Reinventing some piece of the existing as existing system,
[01:34:46] [speaker-4] rather than reimagining how this system could be built from from from the ground up.
[01:34:53] [speaker-2] Yeah,
[01:34:53] [speaker-2] I think that's a good way of putting it.
[01:34:56] [speaker-2] You know,
[01:34:56] [speaker-2] when I kind of started this,
[01:34:58] [speaker-2] when I I
[01:35:00] [speaker-2] I was very cognizant of the fact that there are lots of different frameworks out there,
[01:35:05] [speaker-2] and what I didn't want to do is to just build yet another framework that just has a different DX.
[01:35:11] [speaker-2] Like DX is important,
[01:35:13] [speaker-2] but I I don't think it's it's not something I basically wanted to do.
[01:35:19] [speaker-2] And so my like very key requirement at the very very beginning was like if I'm going to do this,
[01:35:24] [speaker-2] it has to solve a problem that others cannot solve,
[01:35:28] [speaker-2] right?
[01:35:28] [speaker-2] It has to be something that is just a fundamentally different thing that that can provide value that cannot be solved in other ways.
[01:35:37] [speaker-2] And so this is basically what was the motivation for it.
[01:35:41] [speaker-2] And when I started working on this project,
[01:35:43] [speaker-2] I actually didn't want to solve the like the all of it.
[01:35:49] [speaker-2] Like I was just like,
[01:35:49] [speaker-2] oh,
[01:35:49] [speaker-2] can I just reuse an existing renderer,
[01:35:51] [speaker-2] like a React or Lit or some other rendering system?
[01:35:55] [speaker-2] And I looked into it and I started building prototypes.
[01:35:58] [speaker-2] But very quickly,
[01:35:59] [speaker-2] I just kind of realized that like it just doesn't fit.
[01:36:02] [speaker-2] Like the this idea of of being able to lazy load code anywhere and all the time is so pervasive.
[01:36:10] [speaker-2] Mainly because it returns a promise to you,
[01:36:13] [speaker-2] right?
[01:36:14] [speaker-2] That you need to have a system and a rendering pipeline,
[01:36:17] [speaker-2] etc.,
[01:36:17] [speaker-2] that at any point needs to be able to be handed a promise and it needs to be okay with it and not kind of blow up.
[01:36:24] [speaker-2] And many existing systems are not really good at dealing with promises.
[01:36:30] [speaker-2] It's just not native to them,
[01:36:32] [speaker-2] right?
[01:36:33] [speaker-2] You can't just when you look at the rendering APIs of existing systems,
[01:36:38] [speaker-2] they are all fully synchronous.
[01:36:39] [speaker-2] Like when I call render,
[01:36:41] [speaker-2] it's a synchronous update.
[01:36:42] [speaker-4] I see.
[01:36:43] [speaker-2] And yeah,
[01:36:44] [speaker-2] there are tricks.
[01:36:45] [speaker-2] Like React will throw an exception to tell you,
[01:36:47] [speaker-2] like,
[01:36:48] [speaker-2] oh,
[01:36:48] [speaker-2] the promise is not yet resolved.
[01:36:49] [speaker-2] Try again later,
[01:36:50] [speaker-2] right?
[01:36:50] [speaker-2] But you end up in this state where,
[01:36:51] [speaker-2] like,
[01:36:52] [speaker-2] you know,
[01:36:52] [speaker-2] half the stuff is already rendered,
[01:36:54] [speaker-2] and the other stuff is still missing because it hasn't showed up.
[01:36:57] [speaker-2] So,
[01:36:57] [speaker-2] for example,
[01:36:58] [speaker-2] Quick rendering pipeline has to understand this and say,
[01:37:01] [speaker-2] like,
[01:37:01] [speaker-2] look,
[01:37:02] [speaker-2] I am collecting all the changes I'm going to do to the DOM,
[01:37:05] [speaker-2] but until every single bit of it is resolved,
[01:37:08] [speaker-2] I am not rendering it.
[01:37:10] [speaker-2] So it's a different kind of a paradigm and a different rendering model,
[01:37:14] [speaker-2] and so these are the things that I kind of realized that,
[01:37:16] [speaker-2] like,
[01:37:16] [speaker-2] as much as I would like to reuse existing systems because I don't want to build everything from the scratch,
[01:37:22] [speaker-2] it wasn't really possible to to get to the world which was you know highly lazy loadable like I wanted to get to,
[01:37:30] [speaker-2] without also solving these other bits.
[01:37:33] [speaker-2] Also,
[01:37:33] [speaker-2] we didn't,
[01:37:34] [speaker-2] as I said at the very beginnings,
[01:37:35] [speaker-2] we didn't want to build the meta framework either.
[01:37:37] [speaker-2] But it turns out if you don't build the meta framework,
[01:37:40] [speaker-2] then you cannot really show off the capabilities of the framework itself.
[01:37:48] [speaker-4] Yeah.
[01:37:48] [speaker-4] So we are very glad.
[01:37:49] [speaker-4] I am sure all the people who are looking at at Quick are very glad that you made that decision.
[01:37:56] [speaker-4] And it seems like you know.
[01:37:57] [speaker-4] For as I said,
[01:37:58] [speaker-4] we've had we have chart meetings and chairs about this internally,
[01:38:05] [speaker-4] and it looks like the
[01:38:06] [speaker-4] Perfect,
[01:38:07] [speaker-4] you know.
[01:38:08] [speaker-4] If you think about the perfect architecture for building websites,
[01:38:12] [speaker-4] it it seems like Quick is doing that.
[01:38:14] [speaker-4] So thank you for thank you for that.
[01:38:17] [speaker-4] But I'm I'm just wondering,
[01:38:19] [speaker-4] like what what is what is coming down the pipeline next?
[01:38:23] [speaker-4] Like what are the some of the things that you know
[01:38:27] [speaker-4] I am not imagining at the moment that that could be solved or could be could be done differently.
[01:38:33] [speaker-4] And would provide a lot of value to the to the web ecosystem.
[01:38:38] [speaker-7] Yeah,
[01:38:38] [speaker-2] good good question.
[01:38:39] [speaker-2] First of all,
[01:38:39] [speaker-2] thank you for the kind words.
[01:38:40] [speaker-2] I appreciate it.
[01:38:41] [speaker-2] I I like to also oftentimes say like we are trying to do every single performance trick that we can think of.
[01:38:49] [speaker-2] Like,
[01:38:49] [speaker-2] if you can think of a yet another performance trick that you could do,
[01:38:53] [speaker-2] the Quick isn't already doing,
[01:38:54] [speaker-2] like do let me know because we'll probably integrate that one too.
[01:38:57] [speaker-2] So,
[01:38:58] [speaker-2] like everything from lazy loading to prefetching to
[01:39:00] [speaker-2] Lazy execution,
[01:39:01] [speaker-2] resumability,
[01:39:02] [speaker-2] like everything we can think of,
[01:39:03] [speaker-2] like it's all,
[01:39:04] [speaker-2] all in there.
[01:39:06] [speaker-2] You're saying what's coming past one point zero?
[01:39:08] [speaker-2] There's certain things that didn't make it to one point zero.
[01:39:10] [speaker-2] I'm kind of sad,
[01:39:11] [speaker-2] but like,
[01:39:13] [speaker-2] you know,
[01:39:13] [speaker-2] there,
[01:39:13] [speaker-2] you know,
[01:39:13] [speaker-2] there's only so much we can do.
[01:39:15] [speaker-2] One is out of order streaming.
[01:39:17] [speaker-2] It is still something that we want to do,
[01:39:19] [speaker-2] and I think we can do some amazing trickery with that.
[01:39:23] [speaker-2] That's going to come after one point zero,
[01:39:25] [speaker-2] and we.
[01:39:27] [speaker-2] Are working with our friends in Cloudflare,
[01:39:29] [speaker-2] and they're building some amazing demos with microfrontends.
[01:39:33] [speaker-2] Unfortunately,
[01:39:34] [speaker-2] microfrontends are not have not made it into the main documentation yet.
[01:39:38] [speaker-2] So we definitely want to do stuff around microfrontends because we think Quick is really good architecture for microfrontends.
[01:39:45] [speaker-2] But it's it's it requires a lot more documentation,
[01:39:47] [speaker-2] a lot more explaining,
[01:39:48] [speaker-2] a lot more kind of changes.
[01:39:50] [speaker-2] And so we're not there yet.
[01:39:52] [speaker-2] And so that's also not part of V1.
[01:39:54] [speaker-2] So I think those are going to be the
[01:39:56] [speaker-2] Two big pieces that going to happen after version one.
[01:40:00] [speaker-4] That's very interesting.
[01:40:00] [speaker-4] So actually,
[01:40:02] [speaker-4] this might be one of the things that we're considering is at this because we are we're kind of controlling the the request from the browser essentially because you know we have if you build websites on top of edge sites,
[01:40:21] [speaker-4] there are some client side code that's shipped.
[01:40:23] [speaker-4] to the to the browser and that includes a service worker by Geo to kind of prefetch some things and then we're also controlling the CDN software and then the backend as well because our SSR server serverless systems are are rendering the website so
[01:40:42] [speaker-4] one of the things that we we're considering at the CDN level is edge something like edge includes so I'm I'm just wondering like if
[01:40:53] [speaker-4] You know,
[01:40:54] [speaker-4] you could specify thinking about microfrontend.
[01:40:58] [speaker-4] You could specify,
[01:40:59] [speaker-4] oh,
[01:40:59] [speaker-4] this is the this is the ESI tag for header,
[01:41:03] [speaker-4] and this is the ESI tag for the shopping cart or something,
[01:41:08] [speaker-4] and then just a a service worker can can render that and and add that into the into the existing response.
[01:41:17] [speaker-2] Yeah,
[01:41:18] [speaker-2] actually,
[01:41:18] [speaker-2] yeah,
[01:41:19] [speaker-2] that's exactly what we're thinking about.
[01:41:22] [speaker-2] We actually have a nice demo already,
[01:41:24] [speaker-2] so there is a
[01:41:26] [speaker-2] URL you can go try it out.
[01:41:27] [speaker-2] Is it working?
[01:41:31] [speaker-2] Oh,
[01:41:32] [speaker-2] looks like it.
[01:41:32] [speaker-2] Oh no,
[01:41:32] [speaker-2] it works.
[01:41:33] [speaker-2] So if you go to quick dash dream dash demo dot pages dot dev,
[01:41:41] [speaker-2] it's exactly what you're talking about.
[01:41:42] [speaker-2] The idea is that we want to be able to render a page and server side include different parts,
[01:41:49] [speaker-2] but the different parts we're including.
[01:41:50] [speaker-2] Are actually standalone applications.
[01:41:54] [speaker-2] If you think about it,
[01:41:56] [speaker-2] you know,
[01:41:56] [speaker-2] including stuff on a server is relatively easy,
[01:42:00] [speaker-2] but there's more to it than just that.
[01:42:01] [speaker-2] Like,
[01:42:02] [speaker-2] if you just include a chunk of code,
[01:42:04] [speaker-2] chunk of HTML,
[01:42:05] [speaker-2] and then the client-side framework wakes up and starts doing hydration,
[01:42:10] [speaker-2] it will override the stuff that you've included.
[01:42:12] [speaker-2] So,
[01:42:12] [speaker-2] like,
[01:42:13] [speaker-2] you have to.
[01:42:13] [speaker-2] It's not just about just including the HTML.
[01:42:15] [speaker-2] It's also about doing in such a way that when hydration happens.
[01:42:19] [speaker-2] The hydration doesn't destroy the work that you have done,
[01:42:22] [speaker-2] and it turns out Quick is really good at this.
[01:42:25] [speaker-2] The architecture of Quick,
[01:42:26] [speaker-2] and so that demo actually shows off specifically this that we actually have the menu running in a separate web worker from the shopping cart running in a separate web worker from the not a web worker edge worker from from
[01:42:41] [speaker-2] the hero image from the product from the comments,
[01:42:45] [speaker-2] and then all of these things get served side.
[01:42:48] [speaker-2] Bundled together,
[01:42:50] [speaker-2] the advantage is that different parts can be cached at different level,
[01:42:54] [speaker-2] and then all become interactive on a client.
[01:42:57] [speaker-2] You can add a button from the main page,
[01:42:59] [speaker-2] and the shopping cart updates.
[01:43:01] [speaker-2] Even though shopping cart is a separate server side include from the the button that that adds the buy button.
[01:43:10] [speaker-4] Yeah,
[01:43:10] [speaker-4] this is excellent.
[01:43:11] [speaker-4] This is this is exactly this is even better than what I was thinking.
[01:43:15] [speaker-4] But you know,
[01:43:15] [speaker-4] this is a kind of realization of.
[01:43:18] [speaker-4] An idea
[01:43:20] [speaker-4] I had.
[01:43:20] [speaker-4] Excellent.
[01:43:20] [speaker-2] Yeah.
[01:43:21] [speaker-2] So yeah,
[01:43:22] [speaker-2] I think there's a button over there on that site called Show Seams that actually shows you all of the service that include
[01:43:27] [speaker-2] URLs and where they're coming from,
[01:43:29] [speaker-2] etc.
[01:43:29] [speaker-2] And yeah,
[01:43:31] [speaker-2] it is it is kind of the the next step I think in evolution.
[01:43:33] [speaker-2] Like if you look at a super complicated site like Amazon,
[01:43:37] [speaker-2] right?
[01:43:38] [speaker-2] It might be impossible to server side render it,
[01:43:43] [speaker-2] but if you break it up into pieces,
[01:43:44] [speaker-2] you realize like,
[01:43:45] [speaker-2] well.
[01:43:46] [speaker-2] There's only so many hero images that I can show.
[01:43:49] [speaker-2] You know,
[01:43:49] [speaker-2] it's not infinite,
[01:43:50] [speaker-2] and I can pre-render them.
[01:43:51] [speaker-2] And then
[01:43:52] [speaker-2] I all I need to know is which one to to include over here.
[01:43:55] [speaker-2] And the server side include is is inexpensive.
[01:43:59] [speaker-2] And then if all of these actually works with streaming,
[01:44:01] [speaker-2] then you can get into situation where like you you send the the menu and the shopping cart,
[01:44:06] [speaker-2] and let's say the shopping cart needs to talk to database to figure out what's in your shopping cart,
[01:44:10] [speaker-2] and it says,
[01:44:10] [speaker-2] you know what,
[01:44:11] [speaker-2] I'm gonna take some time,
[01:44:12] [speaker-2] so don't don't wait on me,
[01:44:13] [speaker-2] just keep rendering.
[01:44:14] [speaker-2] And so you render.
[01:44:15] [speaker-2] The other parts,
[01:44:16] [speaker-2] and then the shopping cart finally figures out what the answer is,
[01:44:19] [speaker-2] and then sends back an update as like,
[01:44:21] [speaker-2] okay,
[01:44:21] [speaker-2] I know the answer is now three,
[01:44:22] [speaker-2] so go and update it to three.
[01:44:24] [speaker-2] And so at initially,
[01:44:25] [speaker-2] you would render a page that would have maybe a question mark for a shopping cart,
[01:44:29] [speaker-2] and then once the database returns,
[01:44:30] [speaker-2] it goes and updates to the actual thing.
[01:44:32] [speaker-2] So that's what we call the out of order streaming,
[01:44:34] [speaker-2] and it's something that's coming.
[01:44:35] [speaker-2] And it's not only would come here,
[01:44:37] [speaker-2] but it would we would work in a way where it.
[01:44:42] [speaker-2] It could be through server side include,
[01:44:44] [speaker-2] right?
[01:44:44] [speaker-2] So if I server side include a shopping cart,
[01:44:48] [speaker-2] the the inclusion needs to understand the fact that,
[01:44:50] [speaker-2] like,
[01:44:51] [speaker-2] oh,
[01:44:51] [speaker-2] by the way,
[01:44:52] [speaker-2] that shopping cart is not fully done.
[01:44:53] [speaker-2] Like,
[01:44:54] [speaker-2] there's going to be an update coming down later,
[01:44:56] [speaker-2] but don't wait up on me.
[01:44:57] [speaker-2] Go go start rendering the hero in the meantime,
[01:45:00] [speaker-2] which is a separate edge worker.
[01:45:02] [speaker-2] And so when this edge worker finally figures out what the what the update is,
[01:45:06] [speaker-2] then come back and update it.
[01:45:07] [speaker-2] Right?
[01:45:08] [speaker-2] Another example of that would be.
[01:45:09] [speaker-2] Let's say you want to show somebody a product,
[01:45:11] [speaker-2] and you want to show how many items are still available in stock,
[01:45:16] [speaker-2] right?
[01:45:16] [speaker-2] That might be relatively expensive query,
[01:45:18] [speaker-2] and so you just want to show the item,
[01:45:21] [speaker-2] and and for the stock availability,
[01:45:23] [speaker-2] just say computing,
[01:45:24] [speaker-2] or you know something like that,
[01:45:25] [speaker-2] or a spinner.
[01:45:26] [speaker-2] And then you know a second or two later,
[01:45:28] [speaker-2] that spinner would update with the actual number.
[01:45:31] [speaker-4] That's that's amazing.
[01:45:33] [speaker-1] Cool.
[01:45:35] [speaker-1] So we're gonna start.
[01:45:37] [speaker-1] Wrapping up soon,
[01:45:38] [speaker-1] but I think we have one more person who has a question.
[01:45:40] [speaker-1] Val,
[01:45:42] [speaker-11] hi FSJam folks,
[01:45:44] [speaker-11] this is Val from Waterloo,
[01:45:45] [speaker-11] Canada.
[01:45:45] [speaker-11] I love your show,
[01:45:46] [speaker-11] especially the opening music.
[01:45:48] [speaker-11] That's fantastic.
[01:45:49] [speaker-11] Thank you.
[01:45:50] [speaker-11] Hopefully one day.
[01:45:51] [speaker-1] Me actually.
[01:45:52] [speaker-11] Yeah.
[01:45:54] [speaker-11] Mishka,
[01:45:54] [speaker-11] this is Val Niekman.
[01:45:55] [speaker-11] How are you,
[01:45:56] [speaker-11] my friend?
[01:45:57] [speaker-11] Hey,
[01:45:57] [speaker-11] how's it going?
[01:45:58] [speaker-11] Not bad.
[01:45:59] [speaker-11] Not bad.
[01:45:59] [speaker-11] Yesterday I was going through the documentation and everything,
[01:46:03] [speaker-11] trying to wrap my head around what.
[01:46:06] [speaker-11] Quick is quickly,
[01:46:08] [speaker-11] and so I managed to raise the PR in the process as well.
[01:46:13] [speaker-11] One thing that I noticed that a lot of people they're getting really excited and they wanted to come and talk about the things they learn about Quick on YouTube.
[01:46:23] [speaker-11] And sometimes I realize that they have not been able to wrap their head around what Quick is,
[01:46:29] [speaker-11] and you know when the documentation is falling behind the development for too long.
[01:46:36] [speaker-11] Then those YouTube's they show up,
[01:46:37] [speaker-11] they will mislead a lot of people.
[01:46:39] [speaker-11] Now my question is,
[01:46:41] [speaker-11] will you be allocating some time,
[01:46:43] [speaker-11] let's say half a day,
[01:46:45] [speaker-11] for everybody get together and take care of the namings?
[01:46:49] [speaker-11] Because I notice that so many names are flipping back and forth,
[01:46:53] [speaker-11] back and forth.
[01:46:55] [speaker-11] As an example,
[01:46:56] [speaker-11] use visibility task,
[01:46:58] [speaker-11] which is the final name for it.
[01:47:00] [speaker-11] And so that's one question.
[01:47:02] [speaker-11] The last question is.
[01:47:05] [speaker-11] Is browser is understood?
[01:47:06] [speaker-11] Is client is understood?
[01:47:08] [speaker-11] Next,
[01:47:08] [speaker-11] JS decided to call everything server side,
[01:47:13] [speaker-11] unless you specify it specifically.
[01:47:15] [speaker-11] But is server on an edge function that is being advertised as serverless?
[01:47:21] [speaker-11] It just doesn't make sense.
[01:47:22] [speaker-11] It might confuse the young folks.
[01:47:25] [speaker-11] So,
[01:47:26] [speaker-11] is there any way that we could remove is server and just just use if not browser?
[01:47:32] [speaker-11] Those are the questions that I have.
[01:47:33] [speaker-11] Thank you.
[01:47:35] [speaker-2] Yeah.
[01:47:35] [speaker-2] So yeah,
[01:47:36] [speaker-2] I mean,
[01:47:36] [speaker-2] you kind of are hitting the head,
[01:47:38] [speaker-2] so to speak.
[01:47:39] [speaker-2] Why exactly we're not in version one point oh yet?
[01:47:41] [speaker-2] There's still a lot of polish that has to happen,
[01:47:45] [speaker-2] and you know,
[01:47:48] [speaker-2] it turns out a lot of it is actually done by community.
[01:47:50] [speaker-2] Community is helping us.
[01:47:51] [speaker-2] There are lots of awesome people like Shai Resnick who are organizing others to help with the documentation,
[01:47:57] [speaker-2] help with the starters,
[01:47:59] [speaker-2] improve the starters,
[01:48:00] [speaker-2] the CLI,
[01:48:01] [speaker-2] and things of that sort.
[01:48:02] [speaker-2] So all that stuff is just
[01:48:04] [speaker-2] Extra work that has to has to happen,
[01:48:06] [speaker-2] and yes,
[01:48:07] [speaker-2] you're right.
[01:48:07] [speaker-2] We have we originally had the task called was called as thing use client effect.
[01:48:14] [speaker-2] The problem we discovered is that people came too quick with the pre existing notion what the use effect is in React,
[01:48:23] [speaker-2] and so they started putting all kinds of stuff inside of use client effect that really wasn't fitting.
[01:48:30] [speaker-2] Like I kind of talked about the listeners and so on,
[01:48:32] [speaker-2] and so.
[01:48:34] [speaker-2] The rename actually was kind of motivated by the fact that we wanted to actually distance ourselves from the word effect because so many people have a preconceived notion of what it is,
[01:48:45] [speaker-2] and it turns out that's not what it is exactly in Quark.
[01:48:49] [speaker-2] And so,
[01:48:49] [speaker-2] if you just come along and bring your notions and habits,
[01:48:55] [speaker-2] then you're going to end up rebuilding application in a way that is not a performant.
[01:48:59] [speaker-2] All right,
[01:49:00] [speaker-2] and so that's kind of the motivation behind it.
[01:49:02] [speaker-2] So yeah,
[01:49:03] [speaker-2] it's it's a it's a hard problem,
[01:49:05] [speaker-2] but I think we're getting there slowly.
[01:49:08] [speaker-2] And of course,
[01:49:08] [speaker-2] I will encourage you to kind of help with it.
[01:49:10] [speaker-2] If you wanted to help with the documentation or anything like that,
[01:49:14] [speaker-2] by all means,
[01:49:15] [speaker-2] jump in and help us.
[01:49:17] [speaker-11] Absolutely,
[01:49:17] [speaker-11] I got my PR merged in yesterday,
[01:49:20] [speaker-11] and I'm just warming up.
[01:49:22] [speaker-11] So yeah,
[01:49:23] [speaker-11] expect more PR from me.
[01:49:24] [speaker-11] Thank you.
[01:49:25] [speaker-2] Excellent,
[01:49:25] [speaker-2] excellent.
[01:49:29] [speaker-1] Awesome.
[01:49:30] [speaker-1] Well,
[01:49:30] [speaker-1] I think.
[01:49:31] [speaker-1] This is gonna about wrap it up for us.
[01:49:34] [speaker-1] Thank you so much,
[01:49:35] [speaker-1] Mishko.
[01:49:35] [speaker-1] This has been such a great conversation,
[01:49:38] [speaker-1] and thank you everyone who came up to ask questions and speak.
[01:49:42] [speaker-1] And yeah,
[01:49:42] [speaker-1] I think you know you have your Twitter right here.
[01:49:45] [speaker-1] People can follow you,
[01:49:47] [speaker-1] and they can check out Builder IO and Quick.
[01:49:50] [speaker-1] Are there other links you want people to be directed to?
[01:49:54] [speaker-2] Yeah,
[01:49:54] [speaker-2] Builder IO,
[01:49:55] [speaker-2] Quick,
[01:49:55] [speaker-2] and Party Town.
[01:49:56] [speaker-2] I think are the the main places to go,
[01:49:58] [speaker-2] and of course.
[01:49:59] [speaker-2] From the quick build radio,
[01:50:01] [speaker-2] you can check out our link to our Discord,
[01:50:03] [speaker-2] and there's lots of friendly folks to help you out.
[01:50:08] [speaker-4] Yeah,
[01:50:09] [speaker-4] and actually,
[01:50:10] [speaker-4] at the end,
[01:50:10] [speaker-4] I would,
[01:50:11] [speaker-4] you know,
[01:50:13] [speaker-4] would like to thank Misko myself as well,
[01:50:15] [speaker-4] and thank you for for coming here,
[01:50:18] [speaker-4] and thank you for especially for the work that you're doing,
[01:50:21] [speaker-4] and and contribution that you're making to the
[01:50:25] [speaker-4] JavaScript ecosystem and the web ecosystem in in general.
[01:50:29] [speaker-4] So thank you for that,
[01:50:30] [speaker-4] and and good luck.
[01:50:33] [speaker-2] Thank you for the kind words.
[01:50:34] [speaker-2] I appreciate it.
[01:50:35] [speaker-3] Yes,
[01:50:35] [speaker-3] yes,
[01:50:36] [speaker-3] everybody,
[01:50:36] [speaker-3] let's give
[01:50:37] [speaker-3] Misko a huge round of applause.
[01:50:40] [speaker-3] Woo!
[01:50:41] [speaker-3] Yeah.
[01:50:44] [speaker-3] All right.
[01:50:47] [speaker-3] Oh,
[01:50:47] [speaker-3] the applause had to stop.
[01:50:48] [speaker-3] So unfortunate.
[01:50:51] [speaker-3] Thank you so much.
[01:50:55] [speaker-3] Thank you so much,
[01:50:56] [speaker-3] everybody.
[01:50:58] [speaker-3] Been so so good here today,
[01:50:59] [speaker-3] Michio.
[01:51:00] [speaker-3] Thank you for all this wonderful time that you've given here and in your busy day and schedule.
[01:51:06] [speaker-3] So greatly appreciate everybody also coming in the audience there and listening in.
[01:51:12] [speaker-3] And if you come up to speak,
[01:51:14] [speaker-3] thank you so much for that too.
[01:51:16] [speaker-3] And just remember,
[01:51:16] [speaker-3] we will be here every Wednesday at 12 p.m.
[01:51:19] [speaker-3] Pacific Standard Time,
[01:51:20] [speaker-3] as always.
[01:51:21] [speaker-3] And be sure to give us a follow on JavaScript Jam there,
[01:51:24] [speaker-3] and go subscribe to javascriptjam.com on the newsletter there,
[01:51:28] [speaker-3] so you won't be left out missing on any of the awesome things coming up.
[01:51:31] [speaker-3] So,
[01:51:32] [speaker-3] with that being said,
[01:51:35] [speaker-3] really excited for the future here.
[01:51:36] [speaker-3] We're going to be doing some events.
[01:51:38] [speaker-3] In fact,
[01:51:39] [speaker-3] one that I will announce,
[01:51:41] [speaker-3] we are going to be doing some collaboration with Remix Conference,
[01:51:45] [speaker-3] and we got more to come on that in the near future.
[01:51:50] [speaker-3] And there's a couple more events as well that we'll be talking about soon.
[01:51:54] [speaker-3] But yeah,
[01:51:55] [speaker-3] I'm excited about the Remix Conference coming up here in the near future,
[01:52:00] [speaker-3] and we're going to be having some speakers from there come on here as well and join us to just have some great conversation.
[01:52:07] [speaker-3] So keep an eye out for all that.
[01:52:10] [speaker-3] Join the newsletter for more information.
[01:52:12] [speaker-3] All right,
[01:52:13] [speaker-3] thank y'all so much.
[01:52:15] [speaker-3] Really appreciate it,
[01:52:16] [speaker-3] and we'll see you in the next one.
[01:52:22] [speaker-0] Yeah.
[01:52:26] [speaker-0] Thank you.
[01:52:40] [speaker-0] Yeah.
[01:52:42] [speaker-0] Hey.