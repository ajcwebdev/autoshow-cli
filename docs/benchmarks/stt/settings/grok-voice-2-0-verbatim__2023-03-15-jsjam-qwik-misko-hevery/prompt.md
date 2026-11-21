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
[00:00:27] [speaker-0] Welcome. All right. Yeah.
[00:00:33] [speaker-1] Yo, yo,
[00:00:33] [speaker-0] yo. There we go. Welcome, everybody.
[00:00:45] [speaker-1] Oh, how's it going?
[00:00:46] [speaker-0] Welcome to JavaScript Jam Live. We do this every Wednesday at 12 p.m. Pacific Standard Time. Yes.
[00:01:00] [speaker-1] Oh, yeah.
[00:01:02] [speaker-0] And we have a lot of fun, too. We have some great people join us, regulars. There's Jan.
[00:01:11] [speaker-0] She's one of them. She isn't here quite often. But yeah, I just wanted to thank everybody for coming today, and I just wanted to say, whether you're a beginner or whether you're an advanced,
[00:01:25] [speaker-0] uh, learner, because what are we? We, we are, as, as engineers, as developers, we are lifelong learners, right?
[00:01:35] [speaker-0] So what... Whoop, there we go. It went away. All right. Sorry, I was getting a phone call.
[00:01:44] [speaker-0] I need to put this thing on focus mode, y'all. Come on. I think I'm new to the game.
[00:01:50] [speaker-0] Told you, lifelong learner, right? Lifelong learners, that's what we are. And so, uh, whether you're a beginner learner or an advanced learner, we just want to say thank you all for coming, and it
[00:02:01] [speaker-0] doesn't matter who you are, come join us up here on the stage. Just, um, feel free to, uh, ask any questions you want, um, state any facts, opinions, or whatever.
[00:02:10] [speaker-0] We'd love to hear it. All you gotta do is request to come up, and we'd be more than happy to have you on.
[00:02:15] [speaker-0] Uh, but we do have today a special guest, and we're gonna be discussing, I'm sure as you saw from the title there, a little bit about, uh, Quick.
[00:02:25] [speaker-0] So, kinda excited about this one. Anthony, uh, I'm gonna go ahead and make an introduction myself real quick, and then, uh, you can introduce yourself, and then me, so you can go from there,
[00:02:34] [speaker-0] and, and, uh, we'll, we'll get started. I'm, I'm excited. Um, so, my name is Scott Steinlogging, and I am the technical community manager for Edgeio, and co-host of JavaScript Jam.
[00:02:47] [speaker-1] Hello, my name is Anthony Campolo. I am a developer advocate at Egeo, and we are super happy to have Mishko here with us.
[00:02:58] [speaker-2] I guess it's my turn. Hi, I'm Mishko. I am a CTO at Builder.io, and, uh, yeah, I'm so happy to be here.
[00:03:05] [speaker-2] So happy to chat with everybody. Hi, Jen. I've been on your show before. Um, yeah, so let's talk about, uh, things related to quick and web and things of that sort.
[00:03:15] [speaker-1] Yeah, I want to give you a shout out for being on Jen's show, because Jen is a, was in, you know, kind of still is getting into the industry, and you went on and
[00:03:25] [speaker-1] taught her how to write a counter, which was for someone of your stature is kind of funny, but also shows that you're very humble and willing to, you know, work with beginners, I think
[00:03:37] [speaker-1] is, uh, really speaks a lot to your character.
[00:03:40] [speaker-2] I am new to this as well, and so I'm happy to be on Jen's show.
[00:03:46] [speaker-1] Cool. Well, yeah, we're going to be talking about QUIC today and any other things you want to chat about with Builder.
[00:03:54] [speaker-1] I've been kind of looking at the Builder.io blog posts and some of the topics that you had recently been, uh, looking at that I thought might be interesting to get into.
[00:04:05] [speaker-1] But, um, before we kind of start checking those out, we should start with a little bit of your background and the quick 101.
[00:04:15] [speaker-2] Yeah, sure. We're happy to jump into that. Uh, background. Let, let's see. I actually, um, I actually have a degree in computer engineering, which is kind of weird because, like, uh, the thing that
[00:04:27] [speaker-2] I, uh, you know, got my degree in is, like, how transistors work. You know, like, all the way low level, like, CPUs work and, you know, the lowest possible level you can imagine.
[00:04:37] [speaker-2] And somehow over the years, I have slowly transitioned to higher and higher level. Uh, and, you know, cause, you know, computers are just a bunch of abstractions, right, all the way to the, to
[00:04:46] [speaker-2] the top. And so somehow I ended up in, in the web, which is pretty high abstraction, right?
[00:04:51] [speaker-2] Um, and normally when you, like, type A plus B or something like that inside of your web browser, you don't really think about what all the insanity happens underneath to add two numbers together.
[00:05:02] [speaker-2] Um, so yeah, I have kind of a, a strange background. I actually kind of like it cause I kind of joke that I'm probably the only JavaScript engineer that knows how transistors work.
[00:05:09] [speaker-2] Uh, I'm sure there's plenty of others, but it's not a common thing in, in, in the... Hey,
[00:05:14] [speaker-0] I, I love, uh, working on some things. I, I have personally Uh, soldered some commer- some custom boards together with, uh, capacitors, resistors, chips, uh, interesting thing, so.
[00:05:28] [speaker-2] Um, I used to have a big booster of a chip I laid out over my bed, um, but, uh, my, uh, girlfriend, now my wife, she decided that that didn't really fit the bedroom,
[00:05:41] [speaker-2] so it's no longer there.
[00:05:45] [speaker-0] Um,
[00:05:46] [speaker-2] but anyway, so, so somehow I ended up in web technologies, and I actually went to work at Adobe, and there I learned Flex and Flash, and then I ended up at Google, and, you
[00:05:58] [speaker-2] know, I kind of learned that, like, building web apps is just like a big marshalling problem of how do you get your data from the UI to the database and back to the, from
[00:06:07] [speaker-2] the database back to the UI. And so this is where I kind of work a little bit on Angular and AngularJS and Angular, and I done that for a pretty long time, and then
[00:06:17] [speaker-2] like two years ago or three years ago or something like that, I was just like, I just need to try something new, something different, you know.
[00:06:22] [speaker-2] Either that or I'm going to become institutionalized. And so I kind of went out and looked for a bunch of other things.
[00:06:29] [speaker-2] I ended up with Builder.io. They, what really spoke to me is this idea of no-code editor. Uh, what Builder.io does is basically, um, I'm sure you guys are familiar with Wix.
[00:06:38] [speaker-2] Wix allows you to kind of drag and drop editor for building websites, right? But Wix, um, forces all of that to be, you know, you have to host it with Wix.
[00:06:47] [speaker-2] You cannot take the site and like put it in a custom application or something like that. And so with Builder.io is kind of the same exact idea as Wix, except that you can actually
[00:06:56] [speaker-2] embed it into your custom React, Angular, Vue, Svelte, you know, quick application. Uh, and I think that's kind of what's, what's kind of unique and interesting.
[00:07:06] [speaker-2] Anyway, so while at Builder, I, uh, I came to, uh, you know, to my old habits, so to speak, and I was just like, we need to make the web faster.
[00:07:18] [speaker-2] Uh, you know, what's going on is just craziness, it's too slow, and, you know, the big kind of realization is like, well, it's, it's, uh, relatively simple in the sense that, like, the performance
[00:07:28] [speaker-2] or the startup performance of the site is just proportional to how much JavaScript the website has to execute at the beginning, right?
[00:07:36] [speaker-2] And so if you decrease the amount of JavaScript you execute, then your site obviously starts up faster.
[00:07:41] [speaker-2] And so Quick kind of became this journey on how do you not ship so much JavaScript to the browser?
[00:07:48] [speaker-2] And so that's where we are today.
[00:07:52] [speaker-1] Nice. Yeah, I find that this is very much in the zeitgeist right now with JavaScript. A lot of people are concerned with performance, both in the framework world and outside the framework world.
[00:08:05] [speaker-1] I think it's interesting you look at, you know, someone like Alex Russell. He's really giving a similar message to you, but he is saying less so that, you know, we should have a performant
[00:08:17] [speaker-1] framework so much as we shouldn't have a framework at all, or you should, you know, kind of build your own bespoke one for the needs of your specific project.
[00:08:26] [speaker-1] So why do you feel that we should architect these frameworks to be performant instead of just using, like, native web components?
[00:08:36] [speaker-2] I think a lot of people are coming, coming to the same exact conclusion, and the conclusion is that there is too much JavaScript, right?
[00:08:43] [speaker-2] It's kind of a Like obvious conclusion, but it's also a conclusion that is kind of difficult to be actionable.
[00:08:50] [speaker-2] You know, I always kind of joke that when you go to, um, uh, Google Lighthouse score, right?
[00:08:56] [speaker-2] It tells you, decrease the amount of JavaScript. And it's like, yes, yes, I understand that, but like how?
[00:09:01] [speaker-2] Like what's the magic button that I can push to get less JavaScript, right? Um, it's, it's kind of like, you know, you, you go to somebody and they says, well, you know, I decided
[00:09:10] [speaker-2] that your problem is that you're poor, so you just have to make more money. It's like, yeah, I get it, but like how?
[00:09:15] [speaker-2] Like what's the magical thing to do here? Um, and so, uh, I think what Alex a lot of times talks about is this idea of like, let's just be more frugal about things.
[00:09:26] [speaker-2] And I think being frugal is kind of difficult. Like, yeah, I get it. Like, you could be more frugal and be more careful, et cetera.
[00:09:34] [speaker-2] But at the end of the day, you know, we have things to deliver, we have other distractions, et cetera, and so we just want the tools to solve this for us.
[00:09:41] [speaker-2] And so my take on the whole thing is that our tools should be helping us. And I think we're kind of in the world where the tools are somewhere between not helping and actually
[00:09:53] [speaker-2] actively trying to sabotage us. Um, it's not intentional, it's not like we intentionally designed these tools this particular way, but we kind of ended up in this world because We didn't really understand, um,
[00:10:06] [speaker-2] the, the web ecosystem or the web world, and we came to the web world from, uh, kind of the desktop application world, right?
[00:10:13] [speaker-2] Like a desktop application world, like the concept of lazy loading is just not much of a thing.
[00:10:17] [speaker-2] And so you don't really design your framework to kind of take this into account. And if you look at most lazy loaded frameworks today, like most frameworks today, the way they have lazy loading,
[00:10:28] [speaker-2] it's true they have that, but it's a kind of a, I would say an afterthought. It's not the, lazy loading was never inside of version one of any of these frameworks.
[00:10:37] [speaker-2] Lazy loading was something that was added later on, and because it was added later on, it's, it's, uh, it's not like the core primitive of what these things do.
[00:10:46] [speaker-2] And so there's like all kinds of, you know, I would say clever ways of, of lazy load the code, but it, but it, but all of them essentially, uh, have this particular problem, and
[00:10:56] [speaker-2] that is that you can only lazy load code That is currently not needed, which seems kind of obvious, but like what it means in, in, in practice is that if you have a component
[00:11:07] [speaker-2] that is currently on your page, you have to lazy load the code for the component, even though that component might not be doing anything, might not have any behavior, or it might already be
[00:11:16] [speaker-2] rendered and it never needs to be rendered again. But just the way the, the existing tools work and the, the way hydration works, that code has to be present in the client.
[00:11:26] [speaker-2] And so, um, you know, the, the, the mental exercise that Quick is trying to do is to say like, how do we delay the code as much as possible, right?
[00:11:36] [speaker-2] And just take it to an extreme and have the tools just do it automatically. So as a developer, you just don't have to think about
[00:11:43] [speaker-1] it. Awesome. I'll give a shout to Rais, who just joined us. Uh, you want to introduce yourself?
[00:11:52] [speaker-3] Hey. Yeah, sorry. Um, my name is Rais. I am the product manager for Edgeview Sites. Um, I work at Edgeview with, uh, with Anthony and Scott and some other people here.
[00:12:04] [speaker-3] Um, yeah. Just, just listening in and, uh, and being inspired. I have a couple of questions that I'll, I'll save for later, though.
[00:12:16] [speaker-1] Yeah, I'd actually, um, I told Rayese he should definitely make it for this one because he's someone who actually has worked, um, quite deeply with Quick and has, um, kind of scoped it out
[00:12:25] [speaker-1] for some production apps. So I was like, you should definitely hop up here and ask some questions.
[00:12:31] [speaker-1] When you have it, yeah, feel free to jump in at any point. We're just doing kind of like the Quick 101 right now, and then we'll get into some deeper questions as we go.
[00:12:40] [speaker-1] So we talked about Quick, we've talked about kind of the problem it's meant to solve, and it seems like it's aiming for a similar thing to, uh, like partial hydration.
[00:12:52] [speaker-1] How do we manage the amount of JavaScript we have? Same thing with server components. So a lot of different ways that we're trying to approach this problem.
[00:13:01] [speaker-1] And then there's also Quick City as well. So you should talk a little bit about how Quick City fits in here.
[00:13:08] [speaker-2] Yeah, we can talk about that. Uh, but first, um, sorry, I'm going to be a little bit of a stickler, and, uh, I will, uh, try to very politely correct something here you just
[00:13:16] [speaker-2] said. You said, uh, partial hydration. Well, I know it's not
[00:13:21] [speaker-1] partial hydration. I'm saying they're both of the thing you're doing and I think partial hydration are doing are trying to solve the same problem, but I know they're doing it differently, so you can
[00:13:29] [speaker-1] go and go into that if you want. Yes. No, no,
[00:13:30] [speaker-2] no, absolutely. Yeah, no, it's a, I just wanted to make it clear, like, it's a different, it's a, it solves the same problem, right?
[00:13:35] [speaker-2] The problem you're trying to solve is way too much JavaScript is being executed on initial page navigation, right?
[00:13:42] [speaker-2] That, that's the fundamental, the problem you're trying to solve. And there's a lot of different approaches you could take, um, and, you know, QUIC was basically designed from ground up, uh, to delay execute
[00:13:54] [speaker-2] the code extremely aggressively as much as possible, and, uh, that, that's kind of the, its trick, right?
[00:13:58] [speaker-2] That's the thing that it's trying to do, and the argument here is that if you can do that, then you can greatly, uh, lower the amount of JavaScript.
[00:14:07] [speaker-2] So, anyways. Uh, so Quick City, yeah, let's talk about Quick City. So, um, you know, we built Quick, and we originally didn't want to go into the business of building a meta framework.
[00:14:17] [speaker-2] We were kind of hoping that we could either reuse Next.js or Remix or, you know, one of the existing, uh, meta frameworks that are currently out there.
[00:14:25] [speaker-2] Um, but it turns out, like, there is a lot of details that matter, and so whether we liked it or not, we ended up, uh, building a meta framework, um, that can take advantage
[00:14:36] [speaker-2] of, of Quick. And the one way to kind of think about it is, you know, Quick City is kind of like Next.js to React, right?
[00:14:44] [speaker-2] So Quick City is to Quick in the same way. Um, but it solves, it, it takes the problem in a slightly different way.
[00:14:51] [speaker-2] Um, What's unique about QuickCity and Quick is that the frameworks, or you can really think of it together as just Quick, what's unique about it is that they really want to solve the whole
[00:15:00] [speaker-2] problem end-to-end. What I mean by whole problem end-to-end is, um, how do you make the bundles? How do you, uh, break up your code?
[00:15:07] [speaker-2] How do you lazy load the code? How do you make sure that the lazy loading, uh, is pre-cached so that you don't have, you know, uh, hiccups on a small network or, or intermittent
[00:15:17] [speaker-2] network? Um, how do you serialize the data? How do you deserialize the data on the other side?
[00:15:20] [speaker-2] How do you wake up the application? Basically, all of those pieces that are related are solved as a cohesive, uh, problem set.
[00:15:29] [speaker-2] Whereas if you look at the existing systems, um, you know, they, they solve the, the parts in pieces, or maybe they don't.
[00:15:36] [speaker-2] So for example, um, you know, Next.js, um, doesn't really, it relies on existing technologies to create bundles.
[00:15:44] [speaker-2] But it, but because it relies on existing technologies, it means that as a developer, if you want to have a lazy loaded boundary, you have to think about it.
[00:15:50] [speaker-2] You have to put a dynamic import somewhere. Your code base. And if you don't put that in, well then, uh, you know, that particular bid can't be lazy loaded.
[00:15:58] [speaker-2] Whereas with Quick, you know, you don't have to think about it. It's just automatic and, and natural.
[00:16:03] [speaker-2] So, so the, the problem we're trying to solve is that we would like to have a, an environment where the whole part of like serving a web application in the fastest possible way is
[00:16:14] [speaker-2] something that is available to you, sold out of the box. You don't have to think about it as an afterthought.
[00:16:22] [speaker-1] Awesome. Uh, welcome to the stage, Daniel. Um, did you have a question for Michio? And, um, if they're not here right now, Rais, if you want to hop in with any of your questions,
[00:16:35] [speaker-1] feel free.
[00:16:36] [speaker-3] Yeah, so actually, um, as, uh, as Anthony mentioned, I actually built, uh, a production website, a small production website, uh, with Quick.
[00:16:46] [speaker-3] And while, while we were actually building that, um, some of the APIs changed and, um, I was trying to basically see the documentation in, in GitHub and see what, what is going on with
[00:17:00] [speaker-3] the APIs, and I found out that you guys are working on the server, um, you know, server closure, I think it's called, or, or something.
[00:17:09] [speaker-3] Um, yeah, I would love to, you know, get to know what was the motivation behind that. It seems, seems like it should have been done by other people as well.
[00:17:21] [speaker-3] You know, are other people, other frameworks doing it as well, or is, is QuickCity the first one to do this, and what was the, you know, what was the inspiration for that?
[00:17:33] [speaker-2] Yes, I believe you're talking about server dollar sign, right?
[00:17:36] [speaker-3] Yeah, yeah.
[00:17:37] [speaker-2] Okay. Um, yeah, so I think there is a general trend towards, uh, what I call code colocation.
[00:17:43] [speaker-2] This idea that as a developer, you know, we have some codes that runs on a server and some code that runs on the client, um, but we don't really want to think of it
[00:17:51] [speaker-2] as two separate things. We really want to just have a single code base, right? So we want to colocate our server code together with our client code.
[00:17:58] [speaker-2] And if you look at it, like existing frameworks that already do this, you can look at Next.js, there's the, uh, GetServerProps.
[00:18:03] [speaker-2] Um, if you look at Remix, uh, I forget off the top of my head what they have, but they have a similar mechanism by where you can fetch data.
[00:18:10] [speaker-2] And basically all meta frameworks have a mechanism by where, where you can essentially execute code that is, uh, server's only code, meaning it talks to a database or a file system, something that can
[00:18:21] [speaker-2] never be on the client. But, Have a way of making sure that when the bundles are created, that code doesn't end up in the client, right?
[00:18:29] [speaker-2] And so, so this is a trend that I think already has existed for a while. Um, nothing has changed in, in it.
[00:18:35] [speaker-2] And so I think what we're looking for is just a more natural way of mixing server and the client code.
[00:18:42] [speaker-2] So once, uh, we had get server, uh, server props, you know, once that can get started, um, other people have kind of tried to push this idea even further.
[00:18:50] [speaker-2] So like TRPC is another example of like, hey, I have server code, I have client code, how do I make sure that the type information flows through it, uh, and so on?
[00:18:59] [speaker-2] Before something like TRPC, like type information wouldn't flow between the server and the client. And so if you just take this idea even further, then you end up something with a server dollar sign
[00:19:10] [speaker-2] where you can, um, you have a underlying system that knows how to break up your code in such a way so that you don't accidentally ship server, uh, server code to the client, but
[00:19:21] [speaker-2] it's written in such a way where the semantic Meaning of what server-side dollar is, is, uh, is kind of left in the user space, in the developer space, meaning that, you know, I could
[00:19:31] [speaker-2] implement server dollar sign, or I can implement worker dollar sign, or I could implement, uh, you know, any one, only one of others of this, you know, load data on a server dollar sign
[00:19:42] [speaker-2] kind of a thing. And so, um, what Quick kind of, I think, pioneered is kind of unique to Quick, is this idea that you have a marker function that can take code and break
[00:19:53] [speaker-2] it apart, so that you as a developer can decide, well, what does it mean for these two parts to, to do?
[00:19:59] [speaker-2] Like, do I execute the part on the same location or, or, uh, the location on the other side, uh, et cetera.
[00:20:05] [speaker-2] And so we call this idea code collocation and code extraction. Um, and so, uh, Server Dollar Sign actually kind of fits an interesting niche where, you know, you want to just make a call
[00:20:16] [speaker-2] on a server, and so you want to have a simple way of doing it, but you don't necessarily want to reach to something more heavyweight like TRPC.
[00:20:24] [speaker-2] Like TRPC has other advantages in that you can, um, have kind of a different, uh, client, uh, sorry, different teams working on the API side and different team working on the client side.
[00:20:35] [speaker-2] Uh, there's a backwards compatibility story in there saying that you have to make sure that you don't accidentally, because there's a version skew between the, the version that's in the, uh, in the browser
[00:20:42] [speaker-2] versus the version that's on the server, you want to change your APIs in such a way so they're compatible, right?
[00:20:48] [speaker-2] So, so TRPC allows you to do all of these fancy things, uh, but maybe sometimes you don't need it.
[00:20:53] [speaker-2] Sometimes you just want something, uh, quick and simple and, uh, you know, to kind of get you moved on from it.
[00:20:58] [speaker-2] And so something like Server Dollar Sign is an interesting stopgap measure. So what we're doing is we're making it easy for people to collocate server and the client code together.
[00:21:08] [speaker-2] In the saved file and making it easy for us to communicate between that. And for, we think for like ninety percent of the use cases is good enough.
[00:21:17] [speaker-2] And for the more complicated ten percent of the use cases, well, um, you know, there are other tools out there that you can kind of hop in and, um, uh, use.
[00:21:26] [speaker-2] And I think, um, I see Theo is also over here, and I know Theo has, was pretty outspoken about TRPC and how, uh, and, uh, so you can probably jump in and have some
[00:21:33] [speaker-2] opinions as well.
[00:21:37] [speaker-1] Looks like Daniel's got his hand up. You want to hop in?
[00:21:42] [speaker-4] Hello, good evening. Um, sorry, good evening from Nigeria. So, um, I have a question. I write, um, Python, and, um, I use that for artificial intelligence.
[00:21:53] [speaker-4] But is it possible for someone to write, um, AI with JavaScript? Is it really poss- I know you can write it with C++ and Python, but is it possible with JavaScript?
[00:22:05] [speaker-2] Uh, this is not my area of expertise. I, I can answer that one, but go, go for it, yeah.
[00:22:10] [speaker-1] Yeah, so, I mean, so when you're talking about, like, AI, there's different things you can kind of talk about here.
[00:22:17] [speaker-1] So there's actual training, like models themselves, which is typically done in Python, but you can do some of this in JavaScript, like there's a JavaScript, like TensorFlow library, or you can write JavaScript code
[00:22:32] [speaker-1] that's going to hit, like, an API, like OpenAI's API, and with that you can write a JavaScript application that will be hitting essentially the AI kind of services.
[00:22:44] [speaker-1] So for the most part, that's what you'll be doing. You won't really be coding so much direct AI itself itself in JavaScript, but you still work with AI tools in the language of JavaScript.
[00:22:55] [speaker-1] Does that make sense?
[00:22:58] [speaker-4] Yeah, kind of, but, you know, trying to build stuff like a convolutional neural network or a computer vision project, you know, I haven't learned stuff like JavaScript, and I have, um, full interest with,
[00:23:09] [speaker-4] um, with AI. I've been working with AI for quite a long time, just using Python. So, I don't just know, I, I think, I know of the Java TensorFlow.js, but I don't know if,
[00:23:20] [speaker-4] if it can do everything Python can actually do. Just sounds weird. I don't know.
[00:23:28] [speaker-1] Yeah. Yeah, I mean, we're not really AI experts up here, unfortunately, so I think that's probably about all the, the words of wisdom we can give you.
[00:23:37] [speaker-1] It's like, um, Theo, got your hand up?
[00:23:41] [speaker-5] Audi, I wanted to chat a bit of the TRPC stuff just cause I, I agree with parts but not necessarily the whole.
[00:23:48] [speaker-5] I think the, the framing that I've grown to take on is like, what's the distance between your backend and your frontend in a developer experience, or way, where like, co-location is obviously a huge
[00:24:03] [speaker-5] like win in that the backend code that your frontend uses is right there. And when you use a primitive like server dollar sign to like, Generate those functions, you end up with a lot
[00:24:11] [speaker-5] of the, like, type-safe behavior that you would expect from just writing calling functions in TypeScript traditionally. I find that when we look at stuff like REST and GraphQL, there is an abstraction there that
[00:24:23] [speaker-5] makes the distance between the back and in front end code feel much greater, and you have a much more mental overhead to work with when you're making those types of changes in between that
[00:24:33] [speaker-5] relationship. The benefit of that cost is that you now have a back end that can be used for multiple purposes across multiple clients, and the split actually makes the team split better too.
[00:24:43] [speaker-5] One of the points Mr. Co made that I don't necessarily agree with is that TRPC helps, like, the back and in front end teams be separate.
[00:24:49] [speaker-5] I actually think it's uniquely poor in that, in that, like, TRPC is a first-class Backend for frontend.
[00:24:56] [speaker-5] What we're describing here with server dollar sign is a first-class backend primitive in your frontend. And I think the distance between those two things is not very great.
[00:25:06] [speaker-5] Like, I would consider tRPC closer to a server dollar sign type thing than I would to GraphQL, simply because command-click-go to definition works as expected.
[00:25:16] [speaker-5] And I think the magic of tRPC isn't that it's more like GraphQL or more like an RPC, it's that it represents this unique in-between where you get a lot of the DX wins from
[00:25:27] [speaker-5] both and the ability to use your server across multiple platforms and clients.
[00:25:33] [speaker-2] I just want to add something. I agree with everything you said. Do you think it would be a good characterization that you kind of have layers, right?
[00:25:41] [speaker-2] Like server dollar is by far the closest in the distance, and then tRPC is a little further away, but like still, you know, we're pretty close, and then GraphQL would be like kind of
[00:25:50] [speaker-2] the furthest up there, right?
[00:25:53] [speaker-5] Exactly, this is the framing I've been trying to take on more, and while doing it, show the benefits that you get as you leave, like, further out the circle.
[00:26:01] [speaker-2] Yeah, it's a trade-off, definitely.
[00:26:06] [speaker-1] Awesome, looks like we got Real 007 has their hand up. I think this is a first-time caller.
[00:26:14] [speaker-6] Hello?
[00:26:15] [speaker-1] Hey.
[00:26:17] [speaker-6] Hey, guys, uh, my name is Tino, and I have a, a tricky question for Mishko Buds. I don't know if you can answer.
[00:26:26] [speaker-6] So, my question is, as far as I know, Quick and Quick City are still in beta. What are they waiting for in order to hit version 1.0?
[00:26:36] [speaker-6] What is that one thing that they are waiting for? I don't know if Mishko can answer this or not.
[00:26:41] [speaker-6] Yeah, I
[00:26:42] [speaker-2] can, I can, uh, definitely try. Um, I think what we're missing mainly is, uh, documentation, uh, and kind of polish.
[00:26:49] [speaker-2] You know, what we want is we want people to have a good experience, right? So if you come in and you type in, uh, quick create project and, you know, do basic operations, it
[00:26:58] [speaker-2] should all kind of work. And, um, uh, right now we're still getting lots of feedback from the community of like kind of sharp edges where like, things work, but like, you gotta be watch
[00:27:08] [speaker-2] out for this and that, et cetera. And so from our point of view, it is not a high enough standard that we had reached, uh, but we would like to get to version one
[00:27:16] [speaker-2] point oh pretty, uh, pretty soon. Uh, of course, with like anything related to versioning, um, and guesses about the future, you're always wrong about it, right?
[00:27:23] [speaker-2] So I'm not gonna pick a specific date, but I'm just gonna say we're getting pretty close.
[00:27:29] [speaker-6] Okay, okay. No, thank you so much for your time.
[00:27:35] [speaker-1] Also, hello to Ellery. You got any questions for the space? Uh, no, nothing yet, but I will definitely raise my hand eventually.
[00:27:48] [speaker-1] Cool. I know, next gen's coming up.
[00:27:50] [speaker-3] Yes, since, uh, since Ellery is here, it, it reminds me, um, um, one of our actually, one of our largest clients at Egeo is interested in, uh, they're very interested in trying out Quick,
[00:28:04] [speaker-3] um, and You know, think about i-is their websites, um, some of their websites are probably some of the largest e-commerce websites by revenue on the internet.
[00:28:16] [speaker-3] Um, and one of the, one of the problems that we're running into is, uh, their existing websites are built in multiple different kind of, kinds of frameworks, or you can say backends.
[00:28:31] [speaker-3] One would be Next.js, another is, uh, Salesforce Commerce Cloud or something else. And it's just the translating of All the work you've already done in Next.js, um, and, and React into Quake is like
[00:28:46] [speaker-3] a huge, basically you have to rebuild everything, and the, the, the advantage you have with React is there's a huge amount of community work that's available that, that you can use, and, um, that
[00:29:01] [speaker-3] is not, um, not available as much with Quake. So, you know, in, in general, I'm just asking, like, how are you seeing the, um, the community work for Quake and Quake City, and, you
[00:29:15] [speaker-3] know, are, are you seeing any, like, how, how's the, how's the trend graph going for the, for, you know, com, open source components?
[00:29:25] [speaker-2] Yeah, I mean, uh, Quick is pretty new, so obviously our community is nowhere close in size to, to React.
[00:29:31] [speaker-2] Uh, but I think Quick offers some pretty compelling, uh, value propositions in here, right? And so, uh, people who really want to make sure that their sites are fast and have places like e-commerce
[00:29:41] [speaker-2] is a perfect example for this, uh, I think might want to explore it. Now, to help with these, we do have Quick React, which allows you to take existing React components and wrap them
[00:29:51] [speaker-2] in Quick. Obviously, you're not going to get all the magical benefits out of the box. There is, uh, basically Quick React is essentially creating island architecture.
[00:30:00] [speaker-2] Uh, you, you delay hydrating those critical components of that are, uh, Quick, uh, that are React components.
[00:30:06] [speaker-2] So it's not reasonability, but at least you can kind of, uh, work on it together. Um, when I talk about kind of advantages and disadvantages of different technologies, I like to talk about things
[00:30:15] [speaker-2] like intrinsic and extrinsic factors. And so to me, like, um, the fact that, uh, Quick's community and Quick's documentation and the know-how, et cetera, are, um, obviously not as high as somebody who's been
[00:30:29] [speaker-2] around for much, much longer. To me, these are all extrinsic factors, meaning these are things that will change over time.
[00:30:34] [speaker-2] These are not fundamental properties of a particular technology, which is kind of what intrinsic property would be, right, um, of the system.
[00:30:43] [speaker-2] So, yeah, we have a, uh, uh, you know, if you want to use Quick today, you kind of have to, like, really, um, understand the value proposition you're going after and say, like, hey,
[00:30:54] [speaker-2] this is, this is worth the trouble, uh, because, you know, there isn't yet this support system that we have.
[00:31:01] [speaker-2] Having said that, I think we have quite a lot of things already. If you go to the Quick website, There's a showcase.
[00:31:06] [speaker-2] We're actually, we're just rebuilding this, uh, to making it easier. But I think we have quite a lot of existing, um, community support, you know, where, where, uh, I'm just chatting with people who
[00:31:17] [speaker-2] are doing image components, who are doing form support, who are, um, trying to do existing, uh, component libraries for Qlik.
[00:31:26] [speaker-2] Of course, you can just wrap, uh, material components and so on. So a lot of things I think is happening, uh, authentication with, uh, different auth providers.
[00:31:34] [speaker-2] A lot of things is, is happening, but it's just going to take some time, right? And so we're at the beginning of the stage, right?
[00:31:39] [speaker-2] We're not even at version 1.0.
[00:31:44] [speaker-7] Yeah, I can just follow on to that. Um, so I, I think like Qlik has probably the most correct architecture.
[00:31:52] [speaker-7] Like if you put a gun to my head and said, which thing is the right way to build a website, I'd probably pick Qlik.
[00:31:58] [speaker-7] One thing that we did for this particular client is they're both on Next.js, as Ray's mentioned. So we said, all right, let's take some lessons learned from Quick and see what we can implement
[00:32:07] [speaker-7] in Next.js without a full rewrite. So we did a little POC recently where we said, let's try to go very aggressive with bundle splitting.
[00:32:14] [speaker-7] So let's dynamically import all of the things, basically. And let's defer even downloading the JavaScript from the client until certain components have been interacted with.
[00:32:27] [speaker-7] And This had the expected impact that we anticipated for a TBT. So total blocking time had a huge Spike in performance, but then what we did see, there were some visual issues.
[00:32:38] [speaker-7] So one example was when you clicked on the hamburger menu on mobile, and you expect the navigation to, oh, app to open up, you have all these fly-out menus, images that load in, components,
[00:32:49] [speaker-7] fonts, et cetera. There was a visible delay. I'll put it that way. We aren't talking a half second, but it may be a hundred, two hundred milliseconds of delay.
[00:32:59] [speaker-7] So you would tap, and you would like, it was long enough that you would be like, did I really tap that?
[00:33:03] [speaker-7] I'm not sure, and it would show up. So I'm not sure if, you know, you or other people have seen any issues where, like, this aggressive code splitting and dynamically loading JavaScript on interaction
[00:33:14] [speaker-7] has had any adverse user experience impacts.
[00:33:18] [speaker-2] Yeah, that's a, that's a good question. Actually, a lot of people ask that. So, um, absolutely, if you lazy load code on interaction, you will see that, and, uh, that's going to be a
[00:33:28] [speaker-2] problem. This is why we actually have ways of mitigating this, and I think what you're discovering is That you're trying to take the lessons learned from Quake and trying to apply it to an
[00:33:38] [speaker-2] existing system, and then the existing system is really not, uh, really cooperating, right? Because it wasn't designed for this particular bit.
[00:33:47] [speaker-2] So the way Quake solves this particular problem is that we have a service worker. And the service worker's job is to pre-populate the cache, so that when the user goes and clicks on a
[00:33:57] [speaker-2] hamburger menu, uh, and the, the framework starts lazy loading, uh, the code and lazy executing the code associated with the hamburger menu, uh, the code is already in the sitting cache, and therefore you
[00:34:09] [speaker-2] don't have the 200 millisecond delay. It's basically instant, right? And so if you look at existing systems, like if, for example, you lazy loaded everything, you discover like, hey, uh, now you have to
[00:34:20] [speaker-2] solve the next problem, and the next problem is, uh, making sure that the cache has the right assets, and existing frameworks will not do anything to kind of help you in this department, right?
[00:34:31] [speaker-2] Like it's up to you as a developer to kind of write this. Whereas in Quick, uh, we kind of thought about this problem and said, hey, you know, yes, if you start executing code
[00:34:39] [speaker-2] lazily, you will have a problem of delay. How do we make sure that that doesn't happen? Well, we have to, uh, make sure that certain bundles get eagerly downloaded and placed inside of the
[00:34:49] [speaker-2] cache, so that when the user Does interact, there is no delay, uh, available to them. And to do that, now you have to, you're in the business of knowing like, so which bundle contains
[00:34:59] [speaker-2] which code, and which order should the bundles be downloaded? Do I download all the bundles or only some of the bundles, right?
[00:35:04] [speaker-2] And so, uh, again, existing frameworks just have no opinion on this particular matter, and this is where, like, Quick has an opinion, so Quick can keep track of the, the usage.
[00:35:16] [speaker-2] Of what the user does, and based on that, you can provide statistical information to you as a developer that says like, ah, people more normally click on this button first, so make sure you
[00:35:24] [speaker-2] download the bundle with that thing, uh, available first. And, and all of this information as to what bundles to download, in which order, et cetera, all of that becomes just configuration information too quick
[00:35:35] [speaker-2] that is relatively easy to kind of tweak and improve, whereas, um, you know, if you wanted to change the way the bundles are structured in the existing system, you actually have to go to
[00:35:44] [speaker-2] the source code in order to add more dynamic imports or remove dynamic imports, right? It's not something that's just automatic.
[00:35:50] [speaker-2] So again, like, uh, I think you're discovering the case of like, yes, I'm going to take some of the ideas that Quick has, and I'm trying to implement them in the existing systems that
[00:35:59] [speaker-2] are really not designed for this, and then running into all kinds of kind of problems or surprises, and now these problems or surprises are your problem as a developer.
[00:36:08] [speaker-2] They're not the framework's problem. And I think that's kind of the, the big difference with Quick is that with Quick, like, no, this is the framework's problem, and so you don't have Think about
[00:36:18] [speaker-2] it as a developer. Hopefully that, that hits it and answers the question. No, that,
[00:36:23] [speaker-7] that does answer the question. I need to peruse the docs a little bit to then figure out the service worker magic.
[00:36:28] [speaker-7] I mean, not that I'm unfamiliar with service workers, but just understanding how at compile time or runtime we're determining what bundles or scripts should be loaded eagerly because they're, you know, user interaction will
[00:36:40] [speaker-7] depend on them and making sure that they're available. Yeah,
[00:36:43] [speaker-1] so actually... Two of our, two blog posts to the top that are related to this, and if you want to speak about this a little more, Mishko, feel free.
[00:36:50] [speaker-1] Yes,
[00:36:51] [speaker-2] yes, yes. Uh, yeah, so we call it a speculative fetching of code. Um, in order for this to actually work, you need an interesting part, which is, you know, I keep discovering that, like,
[00:37:01] [speaker-2] Quick has these concepts that aren't, don't have an analog in other frameworks. So, for example, one of the concepts that we have in Quick is this idea that the framework at runtime understands the
[00:37:13] [speaker-2] graph of all the objects, meaning it understands Load bundles are, uh, exist in a system, and it understands, like, if I load bundle A, I will also have to load bundle C, and if
[00:37:23] [speaker-2] I want to get a click listener for this particular button, then I know that's going to be found in bundle whatever G or something like that, right?
[00:37:32] [speaker-2] So the, the framework itself understands the graph of, of kind of the, the, the bundles and the symbols available inside of it.
[00:37:41] [speaker-2] And there is no equivalent like that in existing systems. Like, in existing systems, if you take your source code and you feed it through a, uh, bundling system, the bundling system doesn't tell you
[00:37:51] [speaker-2] anything about, like, how the bundles are related, what symbol ended up where. You're kind of on your own, right?
[00:37:57] [speaker-2] And it turns out that having that information, having that graph, is what then enables you to do other things, such as speculative loading of code so that When the user finally clicks on a
[00:38:07] [speaker-2] button, you know that it's gonna, the code is gonna be waiting for the user in the cache, and there'll be no delay.
[00:38:13] [speaker-2] There will be nothing, uh, visual, uh, that is kind of annoying.
[00:38:24] [speaker-1] Yo, Jen, do you have any questions?
[00:38:28] [speaker-6] I do have to remember my question now.
[00:38:33] [speaker-7] And hello, everyone.
[00:38:34] [speaker-1] Well, do you introduce yourself real quick while you're thinking of it?
[00:38:37] [speaker-7] Yeah, I guess this is the exciting time. Um, and Mishko, thank you for being on the show eight months ago.
[00:38:43] [speaker-7] It's crazy to think about that. I, my name is Jen Janot. I am a developer advocate at Ivan, a data infrastructure company.
[00:38:53] [speaker-7] And I also have two shows, one called Teach Jan Tech, where I first met Anthony and
[00:38:59] [speaker-2] Mishko. Uh, they have both been on the show. And I also, oh, and I see Nick. Nick's been on the show too.
[00:39:06] [speaker-2] And, uh, I also have a show called Shit You Don't Want to Talk About, where we talk about mental health and neurodiversity.
[00:39:14] [speaker-2] And yeah, it's been a
[00:39:17] [speaker-7] I had no idea any coding back in like July 2022. So we're almost to a year. We are almost there.
[00:39:24] [speaker-7] And for those who might not have been here at the very beginning of this space, uh, Anthony was complimenting Mishko on coming on my show
[00:39:35] [speaker-1] and teaching me what Quick was when I didn't know what Hacker News was. What was your impression of kind of learning Quick at the time?
[00:39:45] [speaker-1] Did it seem like overwhelming or did it feel like just kind of learning another thing like you, like the way you learned React?
[00:39:51] [speaker-1] Because I, I feel like with beginners, you know, you can kind of give them any framework and start teaching them.
[00:39:57] [speaker-1] They're all going to be equally confusing, you know? So I feel like Quick might have been just like another framework for you.
[00:40:05] [speaker-1] Y-Yes, although I would say when we started going in to the
[00:40:13] [speaker-2] dev tools and looking at the load times to compare them, it made a lot more sense because my previous time was at GoDaddy and of course I always heard of people like hating that
[00:40:27] [speaker-2] their websites was were loading really slow, so it was really cool to see how like the website only loaded what it needed to load instead of absolutely everything when that could slow down a
[00:40:42] [speaker-1] website. Nice, yeah, that is, that's the idea.
[00:40:49] [speaker-2] But I do remember my question because I was Super excited lately that I'm, I'm building, I built one website in Astro and now I'm building another site in Astro.
[00:41:00] [speaker-2] And I was like, you know, I should probably try a different framework eventually. And I just saw on,
[00:41:06] [speaker-7] uh, Builder that you can do quick with Builder. So now I'm really excited to try that one out.
[00:41:13] [speaker-7] But this question is for all of you, like what app would you say to anybody to build their sites with or build things with to be
[00:41:23] [speaker-2] able to test out and really see the differences frameworks? You know, that's a, that's a hard question because like, I feel like the differences between frameworks don't really come to be until your application
[00:41:38] [speaker-2] gets ridiculously large. Um, Like, the thing is, like, any, any framework, when you build a Hello World or Todo List or MovieX app or any of those basic ones, will be just fine, and,
[00:41:51] [speaker-2] you know, things won't really break under pressure because, well, there's just not a lot of it just yet, right?
[00:41:56] [speaker-2] It's when you build a full-size, you know, application that has hundreds or maybe even thousands of components, that's when the size really comes into play and all these tricks start to matter.
[00:42:10] [speaker-1] Yeah, there used to be something called the Real World app, which was kind of like a clone of, like, Medium, the blogging platform.
[00:42:18] [speaker-1] So that's one that used to be really popular to be built in every framework, and then there was, like, TodoMVC, and now we have the Movie app is becoming a big one.
[00:42:27] [speaker-1] This is always a problem, is like, how do we actually find something that can kind of show off the capabilities of each while also finding the kind of pain points?
[00:42:38] [speaker-1] I feel like Benchmarking is good for kind of finding out where they break down, but then just building some sort of like usable app that has users is a good kind of exercise for
[00:42:50] [speaker-1] a developer to go through, because then they have to go through all the different pieces of the framework to make that happen.
[00:42:55] [speaker-1] So yeah, does that kind of answer your question, Jen?
[00:42:59] [speaker-2] Can I, let me just add something to it, sort of jumping from a joke, is, um, I think something like 2D MVC is great to discover what the developer experience is, uh, for the
[00:43:09] [speaker-2] developer, right? Uh, might not be necessarily, uh, best thing to discover when the, the framework will break under load, but it certainly is great as a developer to kind of learn about stuff.
[00:43:21] [speaker-1] I'm thinking, because of course I, I'm learning, uh, now I'm basing everything on data infrastructure
[00:43:27] [speaker-7] and learning that from scratch. So, I, I
[00:43:31] [speaker-1] think something that I don't know if these two concepts go together, uh, like there are data sets that we can use that are public that can be used to be able to put into
[00:43:42] [speaker-1] like, uh, yesterday's show was about Kafka. Is there something like that that could be used to test frameworks, or is that like putting two ideas that don't go together?
[00:43:56] [speaker-2] I think it's not about the amount of data the framework has to show. It's about the amount of code that's associated with that application, right?
[00:44:03] [speaker-2] So like you need to get a application that's complicated enough that it has sufficient amount of code, sufficient number of different developers who went through it and refactored the code in different ways.
[00:44:14] [speaker-2] And of course, whenever you do refactoring, you always do it eighty percent of the way, right? And the last twenty percent is left the other way.
[00:44:19] [speaker-2] Um, it's only then where I think you could discover like how these things actually, uh, scale.
[00:44:27] [speaker-1] That makes sense. Thank you.
[00:44:33] [speaker-3] Actually, um, this, this reminds me of another problem that we are seeing in a lot of, uh, enterprise Um, e-commerce and other, other kinds of, uh, websites that our teams are building, which is
[00:44:47] [speaker-3] that you build a, a pretty decent website with any framework. It could be Next.js, Nuxt, or, or any other framework.
[00:44:56] [speaker-3] And then what happens is when you, it's deployed to production, there's a huge amount of, uh, mark tech, like, you know, Google Analytics, you know, Bot scripts, um, um, Hotjar, other kinds of services,
[00:45:10] [speaker-3] scripts that are in, added to the page, and that is actually the, where the majority of the, of the JavaScript is coming from.
[00:45:20] [speaker-3] Um, so, uh, Misko, uh, mentioned worker dollar, um, like some, something similar to server dollar, uh, primitive that, that exist in Quick, now.
[00:45:33] [speaker-3] Um, is that, you know, I know, uh, that Um, there's this party town framework that exists. Um, but the last time we tried to use it, it's like, it's, it, it's a, it requires
[00:45:49] [speaker-3] a lot of manual work. So are, are you working on something that, that would make that manual work easier or, or reduce the amount of manual work required to, um, move that into a
[00:46:02] [speaker-3] worker?
[00:46:03] [speaker-1] Party town meta framework, yeah,
[00:46:05] [speaker-2] yeah. Uh, yeah, party town is definitely, uh, the, the answer I would give here, you know, for third-party code.
[00:46:13] [speaker-2] Um, you're right, it is not as streamlined as we would like it to be. Uh, it is a hard problem, right?
[00:46:19] [speaker-2] Like, you can't just take, uh, code and just run it in the web worker and expect it to just kind of work out of the box.
[00:46:24] [speaker-2] So there's lots of hoops and complications there. Uh, but yeah, it's, it's the best we have so far in this particular department, right?
[00:46:31] [speaker-2] If you You know, as you correctly observed, um, when you build large-scale application, third-party code is a huge part of it.
[00:46:41] [speaker-2] And I think Google reports that on average, websites have something like 21 different third-party domains, uh, or script tags on their, on their page.
[00:46:49] [speaker-2] And that's a lot, right? And so figuring out how to make sure that the, um, the third-party scripts can be better about the way they run, uh, is something that certainly would help, and
[00:47:00] [speaker-2] so party time is the way to do it. Actually, I've kind of come around in a particular point of view now, and I think many of these third-party scripts could be written, uh, in
[00:47:10] [speaker-2] quick, and I think they would perform better, uh, you know, because if you think about it, what all these third-party scripts do on initialization is they, they just run tons of code at, like,
[00:47:19] [speaker-2] registers listeners and sets this thing up and the other thing, et cetera. And many of these things could, uh, be simplified if they just weren't, uh, weren't there.
[00:47:28] [speaker-2] Um, so The, the initialization, right, the, the resumability of the system is kind of what you would be looking for, and if you could do that for third-party code, I think you would gain
[00:47:39] [speaker-2] a lot of benefits. But that's kind of down the line, right? Like, immediately, I think PartyTown is the only really options that, that's available to us.
[00:47:47] [speaker-1] We have a question from the audience. Will worker dollar sign make most third-party code that's not supported by PartyTown finally work?
[00:47:57] [speaker-2] I think those are two separate things. Like, worker dollar sign would be like the code that you have written, so that you want to run it on a web worker.
[00:48:05] [speaker-2] Uh, PartyTown is really for code that somebody else has written, and you want to make it run on the web worker, right?
[00:48:11] [speaker-2] So there's a, it's a very different kind of use case. Uh, I don't see them as overlapping.
[00:48:19] [speaker-1] Yeah, gotcha. Um, Dev, welcome to the stage. Hello,
[00:48:27] [speaker-3] hello. Um, I can go next, but Ellery has his hand up, so I'll let
[00:48:32] [speaker-1] him. Yeah, sounds good. Let's do that.
[00:48:33] [speaker-7] Uh, cool. While we're talking about PartyTown, I just wanted to ask, have you had any large-scale customers implement PartyTown?
[00:48:42] [speaker-7] I know it's still a beta product. Uh, in my experience with it, I've found that it makes simple things faster and complicated things extremely painful.
[00:48:52] [speaker-7] Um, like if you have a couple of marketing scripts, it probably works well, but for like large enterprise accounts that have 20, 30 distinct marketing scripts, things that want to write directly to the
[00:49:02] [speaker-7] data layer that are third-party scripts, and now you have to intercept that and glue things together. It was pretty tedious to get things going.
[00:49:09] [speaker-7] Um, so just curious, like, if there's any plans to expand that, include support for more third parties, um, and maybe see it in a live production site that has, you know, a bunch of
[00:49:19] [speaker-7] MarTech scripts running on it.
[00:49:21] [speaker-2] Yeah, so the hard part about PartyTown is that you're essentially emulating, uh, the browser in a web worker, right?
[00:49:27] [speaker-2] The, the web worker doesn't have all of the browser APIs like DOM, et cetera, and so you have to do an emulation.
[00:49:33] [speaker-2] And the thing with emulators is that it's easy to get eighty percent, and it's in every additional percentage points, right, that you want to get in terms of like the accuracy, becomes more and
[00:49:44] [speaker-2] more difficult. And so the thing with PartyTown is that it is, um, it is very, very difficult to get, I mean, it's possible, but it's just the amount of time you have to put
[00:49:54] [speaker-2] into it is pretty high, and currently we're just, uh, as a, as a company builder has decided to, um, put its resources behind Quick right now, um, because like that's a direct, uh, benefit
[00:50:07] [speaker-2] to the customers in terms of the code they own. Um, And so PartyTown is not getting as much love as it, it would deserve.
[00:50:15] [speaker-2] I still think it's a pretty cool technology that, that can go places. Uh, but it is a hard thing because like when things don't work, as you point out, uh, you know, the thing
[00:50:24] [speaker-2] you, the issue you have is that you have now a third-party minified script that is throwing some exception, and good luck figuring out in the minified code base that is not even yours, you
[00:50:35] [speaker-2] know, what's going on, why this exception is being thrown, you know, what particular bit have you not emulated correctly enough that, you know, the, the, the third-party code is kind of being confused about
[00:50:45] [speaker-2] it. I think the, the way to get around this particular problem is to almost like create a certification pro-program for, uh, third-party providers and basically say like, hey, wouldn't it be great if the
[00:50:58] [speaker-2] third-party provider would test their own code with PartyTown, verify that it works and, you know, there were no surprises and they, there are either fix it in their side or fix it in PartyTown,
[00:51:07] [speaker-2] you know, while it's not minified. And then, um, That would become almost like a, um, a value add, right?
[00:51:14] [speaker-2] That you could just brag on your seller, hey, our, our third-party script runs in party town, so like we, we made sure that the setup is easy, etc.
[00:51:22] [speaker-2] So I'm chatting actually with, uh, folks at Google about this to see if we could have some kind of a certification program like that.
[00:51:28] [speaker-2] We haven't gotten very far, but I think that's the way to kind of solve this, because solving it, um, by just trying to brutally go through every single discrepancy in behavior, uh, it just
[00:51:41] [speaker-2] puts a huge amount of, uh, resource drain on us, and it's not a, uh, simple, straightforward thing to do.
[00:51:48] [speaker-7] Yeah, I, I was almost questioning at one point whether it was the right solution, uh, just taking compute, moving it to worker threads versus something like Xeraz or server-side tagging, which I think Google
[00:52:00] [speaker-7] Analytics supports. Um, I think that's probably where the future is in my mind, that I have one, you know, MarTech script in my site that publishes events with enough data for, you know, a
[00:52:12] [speaker-7] wide array of other third-party scripts to consume from, and it just fans out in the server to everyone.
[00:52:20] [speaker-2] Yeah, absolutely. There's, there's definitely other ways of solving this problem. I think PartyDown just takes it from the point of view, like, given the, the world that as it is today with these things,
[00:52:30] [speaker-2] these third-party scripts as they are today, uh, you know, what's the best we can do? And so, like, the PartyDown is the answer to that.
[00:52:36] [speaker-2] But if you're willing to change what the status quo is in the world, you know, like that we just move code to the server, yeah, absolutely, that would be a better, uh, solution to
[00:52:44] [speaker-2] the problem, right? Uh, but we're not there yet as an, as an ecosystem.
[00:52:53] [speaker-1] I don't know, I don't know if anyone here watches the show PartyDown every time. Now I hear PartyTown, it kind of makes me think of PartyDown.
[00:53:00] [speaker-1] Very good show. People haven't checked it out. I've never
[00:53:03] [speaker-2] heard of it. I'll check it out.
[00:53:05] [speaker-1] Yeah, it just had a reboot, actually. Um, Dev, do you want to hop in here?
[00:53:11] [speaker-5] Yeah, how's it going? So, I had a question about QUIC. Uh, Mishko, you started this space by, uh, like saying that QUIC is the performant framework, and, uh, you achieve the initial bundle size,
[00:53:24] [speaker-5] like you
[00:53:25] [speaker-6] reduce
[00:53:25] [speaker-5] the bundle size by basically lazy loading the interactive bits, uh, and they're loaded once the user actually interacts with them, right?
[00:53:34] [speaker-5] So, once they are loaded, the interactive bits, there is another dimension of performance, which is when I click a button or when I open a dialog, how quickly are those, how quickly do, do
[00:53:46] [speaker-5] those things appear on the screen? How much work does the CPU have to do to get there?
[00:53:50] [speaker-5] Or when new data is fetched from the server, how quickly is that displayed on the UI? So, I know QUIC has a virtual DOM, but QUIC also has signals, so I was hoping to
[00:54:01] [speaker-5] get some information about, uh, what does that interactivity look like? How do, uh, how does it work with signals and VDOM?
[00:54:09] [speaker-2] Yeah, good question. Yes, definitely there are two different dimensions here, right? There's the dimension of like, how fast can we make the page interactive?
[00:54:16] [speaker-2] And the second dimension is, once the page is interactive, you know, how fast can we update? So, um, in order to get the page interactive on your, on your site as soon as possible,
[00:54:28] [speaker-2] right? Quick has to be super aggressive about lazy execution of the code. And it turns out that if you want to be aggressive about lazy execution of the code, um, solutions that are, uh,
[00:54:40] [speaker-2] coarse-grained reactive, like for example, uh, React or Angular, right, when you change something in React or Angular, um, you are changing a state and the whole thing then propagates.
[00:54:49] [speaker-2] A lot of code executes. And so things that are coarse-grained reactive do not play well with, uh, resumable systems because what's happening is that even if you can get the page, uh, up and
[00:55:02] [speaker-2] running, uh, you know, quickly because you delayed executed the code, the first interaction will likely execute 80% of your application code, right?
[00:55:12] [speaker-2] And that's kind of the problem that you're trying to avoid. So, uh, Quick for that reason is fine-grained reactive, right?
[00:55:18] [speaker-2] So that when things update, we want to be surgical about what we update. So we do use VDOM sometimes.
[00:55:27] [speaker-2] But there should be a big caveat, uh, placed in there, because the way, um, React uses VDOM is that it starts at a particular component, and by default, you know, uh, all child components
[00:55:39] [speaker-2] get rendered underneath it. Now, there's ways to kind of, uh, short-circuit that and, and, you know, make it render less, but like the default behavior is that you start at the root and you,
[00:55:48] [speaker-2] uh, kind of re-render everything below it. Uh, the other thing that happens oftentimes in these systems is that because you put shared state in a, uh, common ancestor, uh, oftentimes, you know, your root
[00:56:00] [speaker-2] component or somewhere close to the root component is where all of your state is. So any modifications of the state tend to like re-render this whole tree, um, uh, for you.
[00:56:10] [speaker-2] And so that has a negative impact on performance. Or rather, the main issue there is that, um, yes, it's slower, but the thing that we really care about is the fact that it forces
[00:56:21] [speaker-2] you to download and execute a whole bunch of code that you otherwise wouldn't have to. And so while Quick does have Vidam, it is very, uh, good at basically updating just the component itself.
[00:56:33] [speaker-2] So if you have a situation where you have a, uh, let's say you have three components, a root component and a child component that has a buy button and another child component that has
[00:56:42] [speaker-2] the shopping cart, right? And so the shared common ancestor is the root component, and then if you push the buy button, you're updating state inside of the root component, which then causes the shopping
[00:56:52] [speaker-2] cart to update, uh, a common setup. So in, in, uh, default behaving systems, the way this would work is that you would re-render everything from a root component.
[00:57:01] [speaker-2] In Quick, what would happen is that because it's a fine-grained reactive, the clicking of the buy button would then directly notify the shopping cart and would completely bypass, um, the other components.
[00:57:13] [speaker-2] They wouldn't even have to download. So even though Quick in that sense has a VDOM, um, it, uh, it doesn't, you know, it, it really prunes the tree automatically for you and it prunes
[00:57:25] [speaker-2] it quite aggressively. But what we've been doing lately in Quick with signals is actually taking it into a whole nother level, which is that if you have a component that doesn't have a structural
[00:57:36] [speaker-2] change, meaning like if you have a component that has like an if statement in there or show A or show B, depending on some flag, that's a structural change to the DOM.
[00:57:44] [speaker-2] If your component doesn't have a structural change to DOM, it only has like updating a, a binding, like current price or quantity or the total.
[00:57:51] [speaker-2] Um, in that particular case, we don't even have to download or execute the VDOM. So if the change isn't structural, then the whole VDOM doesn't even come into play and we don't even have
[00:58:01] [speaker-2] to download the component or execute it or anything like that. We can just directly go and update the, the DOM.
[00:58:08] [speaker-2] So I would say that, um, you know, quick in terms of performance after you initially load the page is going to be somewhere between React and SolidJS.
[00:58:21] [speaker-2] SolidJS being like the undisputed king in terms of like how fast you, you can go. Um, and then React is kind of super popular, but it kind of re-renders, uh, I would say like
[00:58:31] [speaker-2] too much by default. Um, so that's a pretty wide band, but I would say we're probably closer to the solid side than we are in terms of the quick side because, um, you know,
[00:58:41] [speaker-2] we have signals and we have this, uh, VDOM pruning that happens pretty aggressively. Uh, and so for the most operations that you will see, you will actually not even bring VDOM, um, into, into
[00:58:54] [speaker-2] play. But having said that, like I want to point out that there's a lot of websites out there written in React, and for the most part, once the application is up and running, they're
[00:59:04] [speaker-2] plenty fast, right? And so, um, while, yeah, it's important to Kind of focus on runtime performance, I'm going to kind of argue that like, it's, it's a bit of a red herring in the
[00:59:15] [speaker-2] sense that like, just about any technology you choose, usually you end up with a site that's plenty fast for you once it's up and running, right?
[00:59:23] [speaker-2] It's the getting it up and running part that I think we have a problem as an industry.
[00:59:28] [speaker-2] And so that's the, the part that really Quick wants to focus on. Uh, but having said that, right, again, like, we're going to be still a lot faster than Quick.
[00:59:35] [speaker-2] We're going to be probably within, um, you know, reaching distance of what Solid does.
[00:59:43] [speaker-1] Yeah, that's great. I have this one quick follow-up. So it's great that you mentioned that, uh, the runtime performance is mostly a red herring, um, because I think a lot of the discussion around
[00:59:53] [speaker-1] signals has mostly been about the DX. So what, just where do you stand on like, do you think there are DX wins with signals, uh, just apart from the performance?
[01:00:06] [speaker-2] Yeah, absolutely. I love the DX of signals. Um, to us, the real win of signals is not necessarily the performance, although that's nice, but really it's the fact that signals allow us to not
[01:00:19] [speaker-2] execute a whole bunch of code. And the not executing code, first of all, certainly it's a performance thing that like makes the, you know, code run faster, but the real benefit of that is
[01:00:29] [speaker-2] that because I don't have to execute that code, uh, Quick doesn't have to then download the code, right?
[01:00:34] [speaker-2] And so the win to us with signals is not necessarily that, that they run faster, it's that they allow you to not execute and therefore not download a whole bunch of unnecessary code, right?
[01:00:44] [speaker-2] And so you end up with smaller, um, amount of code that has to get shipped to the browser.
[01:00:52] [speaker-2] Got it. Thank you.
[01:01:00] [speaker-1] Uh, Scott, we're at the hour mark. You want to do a quick station break, and then Mishko, um, how, how long do you have to go for?
[01:01:09] [speaker-2] I think I am, I am free after this. Well,
[01:01:14] [speaker-1] okay, I just, a lot of people have questions. Great.
[01:01:19] [speaker-2] I mean, I have enough for the scheduled one, which was 1:30, right? So, like, yeah, I have like an hour.
[01:01:24] [speaker-2] Yeah. So, I'm good.
[01:01:26] [speaker-1] Okay, cool.
[01:01:28] [speaker-0] Nice. All right. Thank you so much. Appreciate everybody, uh, coming up here, talking. Mishko, thanks for joining us today.
[01:01:34] [speaker-0] It's been fantastic so far, and I'm sure it will continue to be that. Oh, man, this has been some great conversation.
[01:01:40] [speaker-0] Just sitting here listening to everybody has been, uh, so fulfilling. So thank you for everybody. Uh, by the way, uh, anybody that's up here that's come up here, and maybe they're not on the
[01:01:49] [speaker-0] stage anymore, um, but either way, if you've gotten value from them, please click on their face there, be sure to follow them, because I guarantee you if you've gotten value from them here, then
[01:01:58] [speaker-0] you will probably get value from them in other places. Uh, so be sure to do that. And hey, you know what?
[01:02:03] [speaker-0] If you want to give JavaScript GM a little follow, we wouldn't mind that either. Um, by the way, if you're not already part of our JavaScript GM newsletter and receiving that in your inbox
[01:02:12] [speaker-0] and getting all that awesome value that Anthony writes up every week, you're missing out. You need to go and subscribe to that guy and, uh, get that come to your inbox so that you
[01:02:22] [speaker-0] can, uh, keep up with the things going on in the world without having to and the world of web dev and JavaScript it is.
[01:02:28] [speaker-0] Without having to, um, you know, really search around too much, we kind of send it right to you.
[01:02:33] [speaker-0] So not just that, it's usually things that we'll be talking about in our Wednesday talks. So, uh, feel free to go there and download or, uh, subscribe, and you can go from there.
[01:02:46] [speaker-0] Anyway, um, thank you all so much. Greatly appreciate it. Remember this as well, if you are a beginner or you're an advanced lifelong learner up here, it doesn't matter.
[01:02:56] [speaker-0] We love to hear from everybody, so feel free to request to come up and, uh, we'll bring you up on stage.
[01:03:01] [speaker-0] You can ask a question, comment, concern, fact, statement, opinion, whatever. We'd love to hear from you. All right.
[01:03:09] [speaker-0] Thank you all so much, and, uh, back to you, Anthony.
[01:03:13] [speaker-1] Yeah, and if, uh, people are interested in quick, you know, these kind of frameworks, then that's really the type of stuff we cover in the newsletter, um, links to a bunch of Mishko's blog
[01:03:25] [speaker-1] posts and podcast interviews and things like that. We also give you a rundown of the weekly podcast episodes.
[01:03:34] [speaker-1] So, looks like Mishko kind of
[01:03:36] [speaker-0] dropped out, and then
[01:03:38] [speaker-1] I, I invited him back up. Back up right now. Um, Cool. Dev, I'm curious. Oh wait, Dev actually is back down as a listener as well.
[01:03:47] [speaker-1] So, Reyes, what's up?
[01:03:50] [speaker-3] Yeah, I was just, uh, just going to bring it to, to build a IO and, uh, you know, just, just for context, as I mentioned, I'm, I'm the product manager for Edgeview Sites, which
[01:04:00] [speaker-3] is a platform for building and running, uh, JavaScript websites. Um, and one of the things we are actually considering is we have a, uh, an old framework, uh, called, um, uh, React Storefront, and
[01:04:17] [speaker-3] it was an e-commerce web development framework, uh, from, from a couple of years ago that hasn't been maintained yet.
[01:04:25] [speaker-3] And we are, we are considering writing that in, uh, in Quick. Um, to solve these kind of performance problems that are, that are so common, especially in e-commerce websites, large e-commerce websites, and then
[01:04:38] [speaker-3] integrating, uh, it with something like, uh, something like Builder.io. So I'm just wondering, like, how do you, do you have, uh, projects like that, um, already, you know, in, in your, that you are
[01:04:52] [speaker-3] aware of that maybe we can learn something from, or, uh, would you be, like, how does, how does this sound to you?
[01:04:59] [speaker-3] Would you be interested in, in collaborating, um, if I plug, plug myself in a little bit?
[01:05:06] [speaker-2] Yeah, absolutely. Uh, actually, we do have something similar already. So first of all, uh, we have a Discord channel, and people who are actually building website, we kind of have, um, that have reached
[01:05:16] [speaker-2] out to us and they want to collaborate like that, we actually have private channels where we kind of help them out, etc.
[01:05:20] [speaker-2] Uh, there is a company that actually selling sporting goods, and I can't remember the name of it right now.
[01:05:26] [speaker-2] And they're doing, uh, something very similar as you're pointing it out, and they're rebuilding their, uh, e-commerce website in, uh, in quick.
[01:05:34] [speaker-2] Um, and so they're having a pretty good experience, and, um, you know, when things arise, they, they reach out to us and we help them out.
[01:05:41] [speaker-2] So yeah, reach out to me on Discord, and I'm happy to set something up.
[01:05:45] [speaker-3] Excellent, thank you.
[01:05:51] [speaker-1] Yeah, do you want to talk about the kind of quick community at all?
[01:05:57] [speaker-2] Yeah, looking like about the community. Um, yeah, so very proud of the community. Uh, they are, um, I think we're now, the Discord channel is about five thousand, um, strong.
[01:06:07] [speaker-2] Um, we have what we call quick heroes, which are a bunch of people who have been with us for a while, and they're super helpful and going around and answering other people's questions, um,
[01:06:18] [speaker-2] and providing feedback and, and building cool things. So yeah, I think Discord is a, is a good place to start.
[01:06:23] [speaker-2] Um, and as a beginner, you can get lots of questions answered over there, um, for us. And, um, yeah, we're, we're trying to make it, you know, easier every day.
[01:06:33] [speaker-2] Right now we're focusing, as I said, uh, for documentation to get it before 1.0 and kind of a revamp on everything.
[01:06:39] [speaker-2] Um, but yeah.
[01:06:45] [speaker-1] Sweet. Um, open floor right now to any of the speakers on the stage. Anyone has questions, feel free.
[01:06:51] [speaker-1] Could be about quick or anything else. And if there's anything else you want to speak about me too we haven't talked about yet or things that are coming up you want people to know
[01:07:05] [speaker-1] about, feel free to do that as well.
[01:07:09] [speaker-2] You know, I, I can, people don't have questions, I can definitely, uh, talk about something. One thing I find interesting, I kind of touched on it earlier, is that, um, when we talk to
[01:07:19] [speaker-2] other folks who are building websites using Next.js, et cetera, there's often like this vocabulary mismatch. Like, for example, uh, we have these dollar signs everywhere, right?
[01:07:29] [speaker-2] And so when we first try to explain it to people, they're like, well, I don't have dollar signs or anything equivalent like that inside of my meta framework.
[01:07:37] [speaker-2] Like, why do you need it? Like, it's kind of hard to wrap my head around it because, like, I was able to build sites without it.
[01:07:43] [speaker-2] So why is this all of a sudden necessary? And, uh, you know, you can build websites without it, right?
[01:07:50] [speaker-2] Like we've been doing it for a while, but this dollar signs gives you a particular value, which is like, hey, you need to, you, you get entry points into your system.
[01:07:58] [speaker-2] And then people of course are like, well, what do you mean by entry points? Like, uh, again, it's not something that I can relate to because we don't really have the equivalent in it.
[01:08:06] [speaker-2] And so we're just kind of constantly discovering that like it requires a bit of a vocabulary shift.
[01:08:12] [speaker-2] So for example, why entry points, right? Well, if you want to be resumable, uh, or rather, let's back up a second.
[01:08:19] [speaker-2] What, what's an entry point for a typical application? Well, there is a, uh, you know, if you have a React application, there is a main bundle somewhere that you load.
[01:08:27] [speaker-2] That main bundle has a function that essentially calls, uh, render, uh, function. I forget the latest API in React, but like there's a render that kind of gets invoked, right?
[01:08:38] [speaker-2] And if you think about it, that's the only entry point that's available in your system. Um, I mean, yes, if you have lazy loading, then there's other entry points, but for the most part,
[01:08:47] [speaker-2] the way React gets a hold of all of your application is that it starts at the root and then traverses all the components and gets hold of the listeners, et cetera.
[01:08:58] [speaker-2] Actually, uh, it's not true just for React. It's true for any existing system, right? Uh, whether it's Angular, Vue, Solid, et cetera.
[01:09:05] [speaker-2] The way these systems get a hold of everything is that they start at the root and they traverse, uh, the components.
[01:09:13] [speaker-2] And so if you want to have a resumable system, you realize like, well, my entry point cannot be the, the root component, because if it's the root component, then the only option I have
[01:09:24] [speaker-2] is, well, start at the root component and, you know, traverse all the children and look for everything.
[01:09:30] [speaker-2] And so you need a way of saying like, I would like to enter the system in other places, not just the root location.
[01:09:36] [speaker-2] And so Quick has, uh, needs to solve the problem of like, how do I create a system where there are lots and lots of entry points?
[01:09:43] [speaker-2] As a matter of fact, the more, the better. And this is where the dollar sign comes in, right?
[01:09:47] [speaker-2] Really what a dollar sign is, is a way to get more entries into the system so that when you, uh, render a, a simple counter with a plus button and a minus button, you
[01:09:59] [speaker-2] know, clicking on plus is a different entry into the system than clicking on the minus, because, you know, one, you know, runs code to increment, one runs code to decrement.
[01:10:08] [speaker-2] Um, and so they, you don't necessarily need to have both of them at present at the same time.
[01:10:14] [speaker-2] Um, and so like we find that it's really hard to explain to people like why we are doing this, why you have to, why you need this.
[01:10:22] [speaker-2] But like once you understand it, like it, uh, it just comes, you know, you, you, you get new vocabulary that kind of is important.
[01:10:29] [speaker-2] Uh, and then with it come secondary problems like, hey, you know, as you, as was kind of pointed out, like we now need to lazy load things.
[01:10:36] [speaker-2] Well, how do we make sure that as a developer you don't have to worry about lazy loading?
[01:10:40] [speaker-2] How do we make sure that you prefetch everything? Uh, and so on. And so there's a lot of concepts that just aren't available in, in, in the other frameworks, and that's what makes it
[01:10:49] [speaker-2] kind of difficult, uh, for people to wrap their head around it, um, at the beginning.
[01:10:55] [speaker-1] Yeah, I find that there's always kind of a vocabulary gap once you start crossing over, even if Frameworks are ultimately building the same thing at the end of the day, a website.
[01:11:07] [speaker-1] The way they get there can be very different and involve different mental models and terminology. You actually wrote a blog post recently, resumability from the ground up.
[01:11:18] [speaker-1] Um, how would you, you want to kind of summarize what that blog post goes through, because I feel like this is another word that is like a vocabulary gap with quick.
[01:11:27] [speaker-2] Yeah. So the, I, I recently been writing a lot of these from ground up posts where, you know, I, I basically, uh, try to solve a particular problem and kind of take you, the
[01:11:37] [speaker-2] reader, through these steps as in like, well, let's say we wanted to do this, you know, what kind of issues- I've really liked them.
[01:11:43] [speaker-1] There's been really good blogging on builder. Oh, thank
[01:11:46] [speaker-2] you. Thank you. I appreciate that. Um, so the, the idea of reasonability is, you know, what if you didn't want to execute any code at the beginning, right, of your application?
[01:11:55] [speaker-2] Um, what kind of steps would you have to go through? And so what that blog post essentially goes through is like, well, the first thing you need to do is like, okay, so you
[01:12:02] [speaker-2] click on a button, and the button is a listener somewhere, right? And that listener is usually buried somewhere deep inside of your JSX.
[01:12:10] [speaker-2] How do you get a hold of it? You know, how do I get a hold of this listener that's, that's, uh, deep down?
[01:12:15] [speaker-2] And so let's say you solve that problem. So the next problem you have is like, great, so now you're executing this listener, but this listener Has no state, like it lost all the information.
[01:12:25] [speaker-2] It's just a code without the state of the system. How does it know what the current value of the counter is?
[01:12:30] [speaker-2] Do I add one to zero or ten or a hundred? Like, you know, what's the current state?
[01:12:35] [speaker-2] And so you have to solve that particular problem. And so you just kind of go through all of these pieces and you kind of realize like, hey, you know, all of these things are
[01:12:43] [speaker-2] things that are, that need to be solved, but there's no equivalent in other frameworks because, well, other frameworks solve this problem by hydration, and hydration just means, uh, just re-execute everything from the beginning.
[01:12:55] [speaker-2] There is no resumability. So yeah, there's a lot of vocabulary, uh, that has to be kind of learned, uh, to get there.
[01:13:05] [speaker-1] Very cool. Yeah, I've heard you give that pitch. Quite a few times now, both interviewing you and listening to you on other things, and I think it makes sense at this point.
[01:13:14] [speaker-1] Took a while, but it seems to be there. Yeah, I
[01:13:17] [speaker-2] also... Sorry, I'm going to go on tangent here. I also find it interesting that a lot of people, like, confuse, um, resumability with, uh, like, delayed hydration.
[01:13:27] [speaker-2] Uh, and the two are really different, um, because, uh, in the case of a hydration, you're still doing all the work, you're just arguing about when the work gets done.
[01:13:38] [speaker-2] Is it now or a little bit later, right? Whereas with resumability, like, that work fundamentally isn't there.
[01:13:44] [speaker-2] Like, there is no hydration, right? And so, like, if you, if we talk about hydration, like, we need to talk about, well, what do you, how do we define hydration?
[01:13:52] [speaker-2] And a lot of people tend to define it as, like, just make the page interactive. But I think that kind of misses the point.
[01:13:58] [speaker-2] The real point of hydration is for the framework to recover its internal state, right? And what I mean by that is, um, for the framework needs to know where are the component boundaries, where
[01:14:08] [speaker-2] are the listeners, what is the state of the component? If I, if this state changes, what other components do I have to re-render, right?
[01:14:15] [speaker-2] This is really what's being rebuilt as part of hydration. And that's the, the hard part. The listener part is relatively easy, uh, to solve and also to kind of, uh, uh, get around, right?
[01:14:28] [speaker-2] Like, yes, at the end of the day, we're doing all this work to make the page interactive, but really hydration is about recovering that internal state for the framework.
[01:14:38] [speaker-2] And so the place where kind of Quick, I think, is unique is that the Quick doesn't go about it this way.
[01:14:45] [speaker-2] Quick basically said, look, I had the state when I did server-side rendering. Uh, and therefore, I just need to somehow move that state from the server to the client.
[01:14:54] [speaker-2] So if I can serialize my state in such a way into HTML that I don't need to rerun any of the components, then I can just literally resume where I left off.
[01:15:04] [speaker-2] And if you think about it, existing applications already have that, right? Like if you look at Next.js, Next.js takes the state of the application And serializes it into, uh, the underscore next underscore app
[01:15:16] [speaker-2] or something like that. I forget the name of the data that gets serialized inside of the HTML, right?
[01:15:20] [speaker-2] That's the state of the application so that your application can just continue where it left off, meaning it doesn't have to re-execute fetching of the data and re-execute, you know, any, anything like that.
[01:15:34] [speaker-2] What's missing is to do the same exact thing, but for the framework, right? And that's the hard part.
[01:15:40] [speaker-2] It's like, you cannot reach into your rendering framework and be like, give me your state so that I can serialize it in such a way so that when you wake up, you can just
[01:15:50] [speaker-2] continue where you left off. Um, and that's the hard part. That's the thing that I think is, uh, is unique, um, and it requires kind of getting your head around it and, and learning
[01:15:59] [speaker-2] about it.
[01:16:01] [speaker-1] Yeah, that was the very big galaxy brain idea for me the first time you explained this to me, the state of your app and the state of the frameworks.
[01:16:08] [speaker-1] It had never even occurred to me to, to think about that before because I'm someone who has used so many frameworks and for the most part can get them to work and do what
[01:16:17] [speaker-1] I need them to do without needing to know too much of the internals, but, um, eventually you have to actually learn that.
[01:16:25] [speaker-2] If you look at two, two different kinds of frameworks, like let's say you're in React and then you want to go to Svelte, right?
[01:16:30] [speaker-2] They, they fundamentally work very similarly. And so while you might need to learn new concepts, uh, it's relatively, I would say, straightforward because these concepts map one to one.
[01:16:40] [speaker-2] Like, how do I get a, uh, uh, hide or show a component? Well, in React, you use this.
[01:16:46] [speaker-2] In Svelte, you do this. And so you have like this mental mapping between the two things, right, that exist.
[01:16:52] [speaker-2] Um, whereas, you know, if you come to it from too quick, sure, we have the mental mapping of like, how do you hide something?
[01:16:59] [speaker-2] How do you show something? But then when you start talking about resumability, it's like, I don't have an equivalent thing on the other side, and so like, what are you talking about?
[01:17:07] [speaker-2] I'm kind of confused, right? And this is the part that, uh, that is hard. And, and so what typically happens is people say like, well, I don't understand what you mean by resumability, but
[01:17:17] [speaker-2] I have this other thing called hydration, so I think you just mean hydration, right? And so they, they desperately try to like bring you back into this thing, and then you're like, well, no,
[01:17:26] [speaker-2] it's not hydration, because like what hydration does is, um, essentially Booting up your framework, right? It's executing all the code so that you can boot up your system.
[01:17:37] [speaker-2] Uh, and that bit is the bit that's kind of skipped,
[01:17:40] [speaker-1] uh,
[01:17:40] [speaker-2] in, in the normal system.
[01:17:42] [speaker-1] We do this in tech when we compare things, which is we can compare two things cause they're trying to solve the same problem, and we can compare two things cause they're actually similar to
[01:17:50] [speaker-1] each other. This happened with Redwood and Blitz. Everyone would always bundle them together and be like, yeah, these two full stack frameworks with React, and they're totally different how they worked architecturally internally, but
[01:18:02] [speaker-1] they always got kind of bundled together. And so it's like, you hear this one thing, it triggers this other idea in your brain.
[01:18:07] [speaker-1] And so, but you have to actually think, wait, these are not the same thing. They're two different things.
[01:18:11] [speaker-1] So what's the difference?
[01:18:13] [speaker-2] Yes. Yes, that's right.
[01:18:16] [speaker-1] Cool. Uh, we got someone else hop up here. Um,
[01:18:19] [speaker-2] Yep. Yep. Uh, hi, everyone. Hi,
[01:18:22] [speaker-1] Mishko. I've, I've asked question a couple of times before from Mishko about the Quick, so I have a new one.
[01:18:29] [speaker-1] In terms of the resumability, I was wondering that since you're serializing the closure, uh, for that matter, is there any specific limitation on that serialization?
[01:18:42] [speaker-1] And like, uh, do you care about the data types that are available in the closure that's supposed to be, uh, serialized and reused again once the, uh, app supposed to resume from that entry
[01:18:55] [speaker-1] point? And the other question would be, uh, is there any process like a gar- garbage collection or anything like that running in the Quick to sort of, uh, unhook the closures that are not
[01:19:09] [speaker-1] being used anymore?
[01:19:11] [speaker-2] Uh, good questions. Um, so the short answer is that you, the closure can close over anything that the systems know how to serialize.
[01:19:20] [speaker-2] So, uh, obviously all the JSON type we know how to serialize, but we can also serialize promises, maps, sets, and of course other closures.
[01:19:28] [speaker-2] Um, so anything that's serializable is something the closure can close over and it will just work. And so this gets, this is nice because closures can close over other closures, which then in turn
[01:19:39] [speaker-2] can close over other things and so on. The thing that's hard about serializing closure is that you need to separate out the, the JavaScript, the behavior from the state, right?
[01:19:51] [speaker-2] And so these two pieces of data Need to, uh, be shipped into separate locations, right? One goes into the bundler, and the other one gets placed inside of your, uh, kind of the, the,
[01:20:03] [speaker-2] the JSON serialized state object. And then the system then needs to put everything back together. And what gets even trippier is that, let's say you're using server dollar sign.
[01:20:13] [speaker-2] Well, in that case, you have a, you know, you know what your code is, right? That's just JavaScript that's available to you.
[01:20:20] [speaker-2] And then you know what variables you closed over, but now you have to ship that information to the server.
[01:20:26] [speaker-2] Except server, you know, client is running ESM, but the server is running CJS. So you can't just like use the same exact code that the client had, because that's not going to work.
[01:20:38] [speaker-2] So you also have to do a little bit of a mapping and be like, oh, right, right.
[01:20:41] [speaker-2] So that closure is actually the equivalent CJS code over here. So let me execute that code instead.
[01:20:46] [speaker-2] And then you have to put the data back into the closure, kind of make it work again.
[01:20:50] [speaker-2] So there's lots of interesting trickery that has to happen in order to make this available. But I think the payback is really, really nice.
[01:20:57] [speaker-2] Uh, one of my favorite ways of, of kind of seeing how you get a payback is that it, you know, in most frameworks, uh, if you say like, hey, I need to listen to
[01:21:07] [speaker-2] a scroll, or let's say I need to listen to a scroll event. The idea that you could set up the listener for the scroll event on a server and then execute the scroll event
[01:21:15] [speaker-2] on the client makes no sense. Like, what are you talking about? Of course I have to wait until I am on the client, and only then can I actually call the add event listener
[01:21:24] [speaker-2] to kind of set up a listener for the scrolling, right? But what this closure trickery allows you to do is to basically say, actually, no, you can in, on the server, before you even
[01:21:35] [speaker-2] have a browser or DOM or anything, you can execute the equivalent of add event listener and set up, say like, hey, I'm interested in listening to this thing.
[01:21:43] [speaker-2] Uh, but then on the client, you don't actually have to do that. You can just continue running the, the execution of the, of the listener.
[01:21:50] [speaker-2] Um, and so that's, I think that's, that's the goal, the, the end goal that you're, you're going after is that you can essentially skip all the add event listeners that need to happen on
[01:21:59] [speaker-2] a client. And it's interesting because it is one of the biggest, um, gotchas we actually found in Quig is that people who come to Quig from other places, uh, they immediately kind of gravitate
[01:22:11] [speaker-2] to their old ways of doing things. And so if they want to set up a scroll listener, they immediately say like, okay, run code eagerly on the client so that I can execute add
[01:22:20] [speaker-2] event listener and register the closure. And then we have to be like, no, no, no, no, you're, you're missing the point here.
[01:22:25] [speaker-2] You actually want to execute this code on a server and then have the closure only materialize if somebody actually does the scrolling.
[01:22:35] [speaker-3] So in this case, is the, is the, um, the compiler, I guess, is it looking at all the event listener calls and then instructing the framework to, to basically invoke them when, when that
[01:22:51] [speaker-3] event happens? Like, how, how, how does that actually work?
[01:22:55] [speaker-2] Yeah, yeah. So this is where the quick loader comes in. Actually, um, the answer is you cannot use add event listener, right?
[01:23:01] [speaker-2] The add event listener is kind of your enemy. And so you need to be able to design a system without it.
[01:23:06] [speaker-2] And so the way we get around this particular problem is that the only place where the listener, the add event listener exists is inside of a quick loader.
[01:23:16] [speaker-2] So quick loader is this piece of code that eagerly executes at the beginning and sets up a global listeners and relies on the fact that browser events bubble.
[01:23:25] [speaker-2] Right? So if the system notices that somebody is interested in scroll events, then it kind of notifies the quick event listener, the quick loader, saying like, hey, by the way, I need to know
[01:23:34] [speaker-2] about these scroll events. And so the, the quick loader sets up a global listener for all scroll events, and then when the event happens, the quick loader tries to figure out, so the event
[01:23:45] [speaker-2] happened, let me go back to where the event originated from and see if I can find a special attribute that tells me which, um, closure I have to execute.
[01:23:57] [speaker-2] And if it finds that information, right, then it actually executes the closure. So the end effect is as if you executed add event listener on a server, that's kind of how it looks like
[01:24:08] [speaker-2] to you as a developer. But of course, in practice, what it just means is that, um, we kind of just delayed it and did it on a client, but we also did it in
[01:24:15] [speaker-2] a way where We don't have to, uh, you, you know, normally if you have ten buttons and you re- set up a, uh, ten on clicks, then you have to register call ad event
[01:24:25] [speaker-2] listener ten times, right? But with Qlik, uh, in the Qlik Loader, you only set up a single, uh, ad event listener in the route for all, uh, Qlik-based events, uh, for the system.
[01:24:38] [speaker-3] That's very interesting. It seems like, you know, um, you know, you hear about these conspiracy, conspiracy theories that all the technical, technological advancements are happening because, uh, you know, some government has the alien
[01:24:52] [speaker-3] technology hidden somewhere, and they're just copying that alien
[01:24:55] [speaker-1] technology.
[01:24:59] [speaker-3] Yeah. So, you know, this, it seems like you, you, you found the perfect architecture in all of these cases, and you're just, you know, checking the things off the list, like, you know, this
[01:25:10] [speaker-3] is the way to do that, and, you know, that's, that's very inspiring. Uh, the other way, this kind of reminds me of another problem that I've been thinking about, and I don't understand this,
[01:25:20] [speaker-3] is, um, When you're using signals, um, the, the re-rendering happens much less because, um, supposedly the, the way the signals change is different from the way use, use state changes in React.
[01:25:41] [speaker-3] So I was just wondering, like, there's, there's very similar primitives in Quick as well, where you can use, uh, there's a primitive called useStore, I think, and then React has a useState, and they
[01:25:56] [speaker-3] seem to work the same way. How is it that one of them can, can result in less amount of re-rendering and the other one doesn't?
[01:26:07] [speaker-2] Yeah. So the, the difference is kind of subtle, but it's super important. And the difference is that, um, if you look at it the way React does it, React is unable to observe where
[01:26:20] [speaker-2] the state is being used, right? Like once you call useState, the useState returns to you a value,
[01:26:29] [speaker-3] and the
[01:26:29] [speaker-2] moment the React returns the value, React fails to have any form of observability into like, what are you going to do with it?
[01:26:38] [speaker-2] Whether you throw the value away, or you pass it to a bunch of other, uh, components, or you use it internally just inside of your component, there is no way for React to know
[01:26:48] [speaker-2] that information, right? That information is just forever lost. And because it's lost, the React can only do the next obvious thing, which is just re-render everything.
[01:26:59] [speaker-2] That's why it's coarse-grained reactive. So what signals and store, and store is kind of just a slightly different signal, uh, what they allow you to do is that, um, when you get back the,
[01:27:12] [speaker-2] uh, the value from the use signal or use store, you don't actually get back the value directly.
[01:27:19] [speaker-2] You instead, you get a wrapper. And this wrapper comes either, uh, in the form of a proxy or a getter and a setter.
[01:27:25] [speaker-2] Uh, there's a lot of different kind of variations on this particular thing. Uh, SolidJS has getters and setters.
[01:27:31] [speaker-2] Uh, MobX has proxies, uh, I think Vue has proxies as well. Um, and so what these proxies allow you to do is that, uh, they, they basically, uh, decouple returning the, the, the, the
[01:27:47] [speaker-2] proxy from returning the value. So now the framework knows when you're actually getting a hold of the value.
[01:27:54] [speaker-2] So when you want to get a hold of the value, you have to either call, uh, call, uh, getter property, or you invoke the getter, or, or do something, and that action of something
[01:28:05] [speaker-2] is information to the framework. And so the framework then is able to make a Basically a subscription, basically make a mark that says, aha, I know that this value has been used here, here,
[01:28:17] [speaker-2] here, and there, right? And so it, it stores this information in such a way that if that value changes in the future, that's easy, like, you know, React knows that because you called setState
[01:28:29] [speaker-2] or so, you know, all the other signal systems that have a similar way of kind of mutating the value.
[01:28:34] [speaker-2] So when the value mutates, now the system knows, okay, I know who to notify to update, whereas React or, or coarse-grained system also Angular falls into this category as well.
[01:28:45] [speaker-2] Well, now Angular has signals. But before signals in Angular, right, um, the framework would be just like, I have no idea.
[01:28:52] [speaker-2] I, the only reasonable thing to do is to re-render the whole world.
[01:28:57] [speaker-3] I see. And, as I understand it, so the, the magic is happening at the compiler looking at the usage of the value and then, um...
[01:29:09] [speaker-3] No,
[01:29:09] [speaker-2] the magic happens at runtime.
[01:29:11] [speaker-3] So it's happening at the runtime. So my question is, like, can we, can we add signals to the React is, is, is the question?
[01:29:19] [speaker-2] Um, yes and no. So yes, because kind of Preact already did it, right? So they definitely can be added.
[01:29:28] [speaker-2] Um, but, uh, it's, it's, uh, it requires a slight changes in the way you think about the problem.
[01:29:37] [speaker-2] And the, the question really isn't about like, can you add signals to React? It's more like, um, if we add signals to React, are we willing to, uh, change the developer's mental model of
[01:29:51] [speaker-2] what React is, right?
[01:29:53] [speaker-3] I see.
[01:29:54] [speaker-2] Um, and so the, the, the issue isn't so much as in a technical issue, as in that doing so, uh, you are asking the developers to think about the problem differently, and is that
[01:30:06] [speaker-2] different way of thinking about it, is it React? Like, for React, for example, really, really prides itself on the idea of, uh, pure functions, right?
[01:30:14] [speaker-2] Like, it's just a bunch of functions that you call in any order you want, and it just kind of works, right?
[01:30:18] [speaker-2] That's kind of their identity. And with signals, that identity changes slightly, and so the question that becomes, like, is that the identity that the core React team, uh, you know, wants for its, its
[01:30:30] [speaker-2] goals?
[01:30:33] [speaker-3] I see, I see.
[01:30:35] [speaker-2] But signals are also kind of like I mentioned, are kind of a prerequisite for, um, reasonability, because, you know, as I said, like, you could in theory resume something like React.
[01:30:49] [speaker-2] But the problem you would have is that the moment something would change, you would be forced to download and re-execute the whole application, right?
[01:30:57] [speaker-2] And so it's, it's almost like you work so hard to get resumability only to like lose it the last inch of the way.
[01:31:06] [speaker-3] I see, because, because you're not shipping the closure to, to the front end, you're just shipping the result or a, a, a kind of executed function?
[01:31:18] [speaker-2] Uh, well, no, so, so resumability makes sense only if you can guarantee that the amount of code that you're gonna have to lazy execute is not too much, right?
[01:31:30] [speaker-2] And so if, If the first interaction basically says that I need to download the whole code base and execute the whole code base, then it's like, well, why does this work to delay it?
[01:31:40] [speaker-2] Like,
[01:31:41] [speaker-3] you're not really
[01:31:42] [speaker-2] gaining anything, right? And so reasonability has like this strong preference for fine-grained systems.
[01:31:50] [speaker-3] I see. Yeah, thank you. Thank you for that.
[01:31:58] [speaker-2] You know, you asked me like, is this alien technology? Um, no, it's not. But the way, way I think about this particular problem is that, you know, you set a goal for yourself.
[01:32:09] [speaker-2] And for the case of a quick, the goal is very simple, which was, uh, delay execution of the code.
[01:32:16] [speaker-2] And so then you can ask yourself, well, how aggressive do you want to be about this goal?
[01:32:21] [speaker-2] And I find that in life, a lot of times it's easier to just pick extremes because then you ha- don't have to like have a debate about it.
[01:32:30] [speaker-2] Like, uh, you either smoke or you don't smoke, right? There is very difficult to be like, I only smoke one cigarette a day, right?
[01:32:39] [speaker-2] Uh, so like it's much easier to be at the extreme. So, so when we were, uh, when I started working on Quick, my philosophy was very simple, which is like, I want to be
[01:32:47] [speaker-2] in a situation where the only time when I download a piece of code is if I execute it.
[01:32:55] [speaker-2] So that I will essentially always be in a situation that if I look up code coverage of my code base, it should be pretty close to a hundred percent at all times.
[01:33:05] [speaker-2] Right? It seems like a crazy extreme thing, but then you just work backwards from that and you say like, okay, so how do I get there?
[01:33:12] [speaker-2] Like, what do I need to do in order to get there? And so you kind of come to the conclusion like, well, you need to be able to, uh, you know, start at the
[01:33:19] [speaker-2] listener, right? Like, because the listener, when you click on a, on a button, the first thing that executes is the listener handler.
[01:33:26] [speaker-2] So, you know, how do you get the listener handler? You know, solve that problem. Uh, how does the listener get a state?
[01:33:32] [speaker-2] Solve that problem. And then just keep solving it until you either have a moment where like, this is impossible, or, you know, you sleep on it and somehow figure out how to get over
[01:33:41] [speaker-2] that problem and you keep going. And so, so quick is just kind of the result of that particular, uh, point of view.
[01:33:49] [speaker-2] And I'm not saying that your application should only download the code when it has to execute it, but I'm saying is by starting at that point of view, um, it allows you to build
[01:33:59] [speaker-2] all of these solutions, and then later you can always back off on it.
[01:34:06] [speaker-3] That's very interesting. I guess that's, that might be, you know, if you had started at solving a different problem, you might have, yeah, you might have arrived at a very different, um, situation, like
[01:34:20] [speaker-3] where instead of having that problem or of only downloading the code that's going to be executed, you try to optimize the way the state works or some other piece of the problem, essentially.
[01:34:38] [speaker-3] Um, then you would be basically reinventing some piece of the existing, uh, existing system rather than Reimagining how the system could be built from, from, from the ground up.
[01:34:53] [speaker-2] Yeah, I think that's a way, a good way of putting it. Um, you know, when I kind of started this, when I, uh, I, I was very cognizant of the fact that there are
[01:35:02] [speaker-2] lots of different frameworks out there. And what I didn't want to do is to just build yet another framework that just has a different DX.
[01:35:11] [speaker-2] Like, DX is important, um, but I, I don't think it's, um, it's not something I basically wanted to do.
[01:35:19] [speaker-2] And so my, like, very key requirement at the very, very beginning was, like, if I'm going to do this, it has to solve a problem that others cannot solve, right?
[01:35:28] [speaker-2] It has to be something that is just a fundamentally different, uh, thing that, that can provide value that cannot be solved in other ways.
[01:35:37] [speaker-2] Um, and so this is basically what was the motivation for it. And when I started working on this project, I actually didn't want to, uh, solve the, like, the, all of it.
[01:35:49] [speaker-2] Like, I was just like, oh, can I just reuse an existing renderer, like a React or Lit or some other rendering system?
[01:35:55] [speaker-2] And I looked into it and I started building prototypes, but very quickly I just kind of realized that, like, it just doesn't fit.
[01:36:02] [speaker-2] Like, the, this idea of, of being able to lazy load code anywhere and all the time, uh, is so pervasive, mainly because it returns a promise to you, right?
[01:36:14] [speaker-2] Um, that you need to have a system and a rendering pipeline, et cetera, that at any point needs to be able to be handed a promise and it needs to be okay with it
[01:36:22] [speaker-2] and not kind of blow up. And many existing systems are not really good at dealing with promises.
[01:36:30] [speaker-2] Uh, it's just not native to them, right? You can't just, um, when you look at the rendering APIs of existing systems, they are all fully synchronous.
[01:36:39] [speaker-2] Like when I call render, it's a synchronous update.
[01:36:42] [speaker-3] Um,
[01:36:44] [speaker-2] and yeah, there are tricks like React will throw an exception to tell you like, oh, the promise is not to resolve try again later, right?
[01:36:50] [speaker-2] But you end up in the state where like, you know, half the stuff is already rendered and the other stuff is still missing because it hasn't showed up.
[01:36:57] [speaker-2] So for example, quick rendering pipeline has to understand this and say like, look, I am collecting all the changes I'm going to do to the DOM, but until every single bit of it is
[01:37:07] [speaker-2] resolved, I am not rendering it. And so it's a different kind of a paradigm and a different rendering model.
[01:37:14] [speaker-2] And so these are the things that I kind of realized that like, as much as I would like to re- reuse existing systems, because I don't want to build everything from the scratch, um,
[01:37:22] [speaker-2] it wasn't really possible to, to get to the world, which was, uh, you know, highly lazy loadable like I wanted to get to without also solving these other bits.
[01:37:33] [speaker-2] Uh, also we didn't, as I said at the very beginnings, we didn't want to build the meta framework either.
[01:37:36] [speaker-2] Uh, but it turns out if you don't build the meta framework, uh, then you cannot really, um, show off the, the capabilities, uh, of the framework itself.
[01:37:48] [speaker-3] Yeah. So we, we are very glad. I am sure all the people who are looking at, at Quick are very glad that you made that decision.
[01:37:56] [speaker-3] And it seems like, you know, for, as I said, we've had, uh, We have chart meeting ventures about this internally, um, and it looks like the perfect, you know, if you think about the
[01:38:09] [speaker-3] perfect architecture for building websites, it, it seems like Quick is doing that. So thank you for, thank you for that.
[01:38:17] [speaker-3] But I'm, I'm just wondering, like, what, what is, what is coming down the pipeline next? Like, what are the, some of the things that, you know, I, I am not imagining at the moment
[01:38:29] [speaker-3] that, that could be solved or could be, could be done differently and would provide a lot of value to the, to the web ecosystem?
[01:38:38] [speaker-2] Yeah, good, good question. Uh, first of all, thank you for the kind words. I appreciate it. I, I like to also, uh, oftentimes say like, We are trying to do every single performance trick
[01:38:48] [speaker-2] that we can think of. Like, if you can think of, uh, yet another performance trick that you could do, the quick isn't already doing, like, do let me know, because we'll probably integrate that
[01:38:56] [speaker-2] one too. Uh, so, like, everything from lazy loading to prefetching to lazy execution, resumability, like everything we can think of, like, it's all, uh, all in there.
[01:39:06] [speaker-2] Um, you're saying what's coming past 1.0? There are certain things that didn't make it to 1.0, and I'm kind of sad, but, like, uh, you know, there, you know, there's only so much we
[01:39:14] [speaker-2] can do. Uh, one is out-of-order streaming. Uh, it is still something that we want to do, and I think we can do some amazing trickery with that.
[01:39:23] [speaker-2] Uh, that's going to come after 1.0, and, um, we are working with our friends in Cloudflare, and they're building some amazing demos with a microfrontend.
[01:39:33] [speaker-2] Um, unfortunately, microfrontend are not, have not made it into the, uh, main documentation yet. So we definitely want to do stuff around microfrontend, uh, because we think QUIC is really good architecture for microfrontend.
[01:39:44] [speaker-2] Uh, but it's, it's, uh, it requires a lot more documentation, a lot more explaining, a lot more kind of changes, and so, uh, we're not there yet, and so that's also not part of
[01:39:54] [speaker-2] v1. So I think those are going to be the two big pieces that are going to happen afterwards in one.
[01:40:00] [speaker-3] That's very interesting. So actually, this might be one of the things that we are considering is, um, at the same, because we are, we're kind of controlling, um, the, the request from the browser,
[01:40:14] [speaker-3] essentially, because, you know, we have If you build websites on top of edge sites, um, there are some client-side code that's shipped to the, to the browser, and that includes the service worker by
[01:40:26] [speaker-3] Geo to kind of prefetch some things. And then we're also controlling the CDN software and then the backend as well, because, uh, our SSR, so serverless systems are, are rendering the website.
[01:40:40] [speaker-3] So one of the things that we're, we're considering, uh, at the CDN level is, um, uh, edge size, something like edge size includes.
[01:40:51] [speaker-3] So I'm, I'm just wondering, like, if You know, you could specify, thinking about microfront, and you could specify, oh, this is the, this is the ESI tag for header, and this is the ESI
[01:41:05] [speaker-3] tag for the, the shopping cart or something, and then just a, um, a service worker can, can render that and, and add that into the, into the existing response.
[01:41:17] [speaker-2] Yeah. Uh, actually, yeah, that's exactly what we're thinking about. Uh, we actually have a nice demo already, so there is a, um, a URL you can go try it out.
[01:41:27] [speaker-2] Is it working? Oh, looks like it. Oh, no, it works. So if you go to quick dash dream dash demo dot pages dot dev, Um, it's exactly what you're talking about.
[01:41:42] [speaker-2] The idea is that we want to be able to render a page, and server-side include different parts, but the different parts we're including are actually, uh, standalone applications.
[01:41:54] [speaker-2] If you think about it, You know, including stuff on a server is relatively easy, but there's more to it than just that.
[01:42:01] [speaker-2] Like, if you just include a chunk of code, chunk of HTML, and then the client-side framework wakes up and starts doing hydration, it will override the stuff that you've included.
[01:42:12] [speaker-2] So, like, you have to-- it's not just about just including the HTML, it's also about doing in such a way that when hydration happens, the hydration doesn't destroy the work that you have done.
[01:42:22] [speaker-2] Uh, and it turns out Quick is really good at this, uh, the architecture of Quick. And so that demo actually shows off, uh, specifically this, that we actually have the menu running on a
[01:42:32] [speaker-2] separate, uh, web worker from the shopping cart, running on a separate web worker from the-- not a web worker, uh, edge worker, from, um, from the hero image, from the product, from the comments.
[01:42:44] [speaker-2] Um, and then all of these things get server-side bundled together. Uh, the advantage is that different parts can be cached at different level.
[01:42:54] [speaker-2] And then all become interactive on a client. Uh, you can add a button from the main page and the shopping cart updates, even though shopping cart is a separate server-side include from the, the
[01:43:05] [speaker-2] button that, that adds to the buy button.
[01:43:10] [speaker-3] Yeah, this is excellent. This is, this is exactly, this is even better than what I was thinking, but, uh, you know, this is a kind of realization of an idea I had.
[01:43:20] [speaker-3] Excellent.
[01:43:20] [speaker-2] Yeah. So yeah, uh, I think there's a button over there on that site called show scenes that actually shows you all the server-side include, uh, URLs and where they're coming from, et cetera.
[01:43:30] [speaker-2] And, uh, yeah, it is, it is kind of the, the, the next step, I think, in evolution.
[01:43:33] [speaker-2] Like, um, if you look at a super complicated site like Amazon, right, I, it might be, uh, impossible to server-side render it, but if you break it up into pieces, you realize like, well,
[01:43:46] [speaker-2] There's only so many hero images that I can show. Uh, you know, it's not infinite, and I can pre-render them, and then, uh, I, all I need to know is which one to, to
[01:43:55] [speaker-2] include over here, and the server-side include is, is inexpensive. And then if all of these actually works with streaming, then you can get into a situation where, like, you, you send the, the menu
[01:44:06] [speaker-2] and the shopping cart, and let's say the shopping cart needs to talk to the database to figure out what's in your shopping cart, and it says, you know what, I'm gonna take some time,
[01:44:12] [speaker-2] so don't, don't wait on me, just keep rendering. And so you render the other parts, and then the shopping cart finally figures out what the answer is, and then sends back an update, says
[01:44:21] [speaker-2] like, okay, I know the answer is now three, so go and update it to three. And so at initially, you would render a page that would have maybe a question mark for a shopping
[01:44:28] [speaker-2] cart, and then once the database returns, it goes and updates with the actual thing. So that's where we call the out-of-order streaming, and it's something that's coming, and it's not only, uh, would come
[01:44:37] [speaker-2] here, but it would, we would work in a way where Uh, it, it could be, uh, through server-side include, right?
[01:44:45] [speaker-2] So if I server-side include a shopping cart, the, the inclusion needs to understand the fact that like, oh, by the way, that shopping cart is not fully done.
[01:44:53] [speaker-2] Like, there, there's going to be an update coming down later, but don't wait up on me. Go, go start rendering the hero in the meantime, which is a separate edge worker.
[01:45:02] [speaker-2] And so when this edge worker finally figures out what the, what the update is, then come back and update it, right?
[01:45:08] [speaker-2] Another example of that would be, let's say you want to show somebody a product and you want to show how many items are still, uh, available in stock, right?
[01:45:16] [speaker-2] That might be a relatively expensive query, and so you just want to show, uh, the item and, and for the stock availability, just say computing or, you know, something like that, or a spinner,
[01:45:26] [speaker-2] and then, you know, a second or two later, that spinner would update with the actual number.
[01:45:31] [speaker-3] That's, that's amazing.
[01:45:35] [speaker-1] Cool, so we're, I guess, start wrapping up soon, but I think we have one more person who has a question.
[01:45:40] [speaker-1] Val.
[01:45:42] [speaker-2] Hi, FSF folks. This is Val from Waterloo, Canada. I love your show, especially the opening music. That's fantastic.
[01:45:50] [speaker-1] Thank you. It's me, actually.
[01:45:52] [speaker-2] Yeah. Um, Mishka, this is Val Diekman. How are you, my friend? Hey, how's it going? Not bad, not bad.
[01:45:59] [speaker-2] Yesterday I was going through the documentation and everything, try to wrap my head around what Quick is quickly.
[01:46:08] [speaker-2] And, um, so I managed to raise a PR in the process as well. One thing that I noticed that a lot of people, they're getting really excited and they wanted to come and talk
[01:46:20] [speaker-2] about the things they learned about Quick on YouTube. And sometimes I realize that they have not Being able to wrap their head around what QUIC is, and, you know, when the documentation is falling
[01:46:33] [speaker-2] behind the development for too long, then those YouTubes, they show up, they will mislead a lot of people.
[01:46:39] [speaker-2] Now, my question is, will you be allocating some time, let's say half a day, for everybody get together and, um, take care of the namings?
[01:46:49] [speaker-2] Because I noticed that so many names are flipping back and forth, back and forth. Um, as an example, use visibility task, which is the final name for it.
[01:47:00] [speaker-2] And so that's one question. The last question is, um, is browser is understood, is client is understood, Next.js decided to call everything server side, unless you specify it specifically.
[01:47:16] [speaker-2] But is server on a edge function that is being advertised as serverless, it just doesn't make sense.
[01:47:22] [speaker-2] It might confuse the young folks. Uh, so Is there any way that we could remove a server and just use, if not browser?
[01:47:31] [speaker-2] Uh, those are the question that I have. Thank you.
[01:47:35] [speaker-1] Yeah. So yeah, I mean, you kind of, uh, are hitting the hell on the head, so to speak, why exactly we're not in version 1.0 yet.
[01:47:41] [speaker-1] There's still a lot of, uh, polish that has to happen. And, uh, you know, uh, it turns out a lot of it is actually done by community, and community is helping us.
[01:47:51] [speaker-1] Uh, there are lots of awesome people like Shai
[01:47:53] [speaker-2] Resnick who are organizing others to help with the documentation, help with the starters, uh, improve the starters, the CLI, and things of that sort.
[01:48:02] [speaker-2] Uh, so all that stuff is just extra work that has to, has to happen. And yes, you're right, we have, um, we originally had the task
[01:48:11] [speaker-5] called, was called, I think, use client effect. Uh, the problem we discovered is that people came to
[01:48:18] [speaker-2] Quake with the, uh, pre-existing notion what the use effect is in React, and so they started putting all kinds of stuff inside a use client effect, uh, that really wasn't fitting, like I kind
[01:48:30] [speaker-2] of talked about the listeners and, and so on. And so, uh, the rename actually was kind of motivated by the fact that, uh, we wanted to actually distance ourselves from the word effect because
[01:48:42] [speaker-2] so many people have a preconceived notion of what it is, and it turns out that's not what it is
[01:48:48] [speaker-5] exactly in Quake, and so if you just come along and bring your notions and habits, then you're gonna end up rebuilding application in a way that is not a performance, alright?
[01:49:00] [speaker-5] And so that's kind of the motivation behind it. Um, so yeah, it, it's, it's a, it's a hard problem, uh, but I think we're getting there slowly.
[01:49:08] [speaker-1] And of course, I will, uh, encourage
[01:49:09] [speaker-5] you to kind of help with it. If you wanted to help with the documentation or anything like that, uh, by all means,
[01:49:15] [speaker-6] uh, jump in and help us.
[01:49:17] [speaker-2] Absolutely. I, uh, got my PR version yesterday, and I'm just, uh, warming up. So, uh, yeah, expect more PR from me.
[01:49:24] [speaker-2] Thank you.
[01:49:25] [speaker-6] Excellent, excellent.
[01:49:29] [speaker-1] Awesome. Well, I think, uh, this is gonna about wrap it up for us. Uh, thank you so much, Mishko.
[01:49:35] [speaker-1] This has been such a great conversation, and thank you everyone who came up to ask questions and speak.
[01:49:42] [speaker-1] And yeah, I think, you know, you have your Twitter right here. People can follow you, and they can check out Builder.io and Quick.
[01:49:50] [speaker-1] Are there other links you want people to be directed to?
[01:49:54] [speaker-2] Yeah, Builder.io Quick and Partytown, I think, are the, the main places, uh, to go in. Of course, from the Quick.Builder.io, you can check out our, uh, link to our Discord, and, uh, there's lots
[01:50:05] [speaker-2] of friendly folks to help you out.
[01:50:08] [speaker-3] Yeah, and, uh, actually, at the end, I would, you know, um, would like to thank Misko myself as well, and, uh, thank you for, for coming here, and thank you for, especially for the
[01:50:19] [speaker-3] work that you're doing and, and the contribution that you're making to the JavaScript ecosystem and the web ecosystem in, in general.
[01:50:29] [speaker-3] So thank you for that, and, uh, and, uh, good luck. Thank you
[01:50:33] [speaker-7] for the kind words. I appreciate
[01:50:35] [speaker-0] it. Yes, yes, everybody, let's give, uh, Misko a huge round of applause. Woo! Yeah. Oh, oh, the applause has to stop, unfortunately.
[01:50:51] [speaker-0] Thank you so much. Thank you so much, everybody. Uh, we've been so, so good here today, Mitchell.
[01:51:00] [speaker-0] Thank you for all this wonderful time that you've, uh, uh, given here in, in, uh, in your busy day and schedule.
[01:51:06] [speaker-0] So, uh, greatly appreciate everybody also coming in the audience there and listening in, and if you come up to spoke, speak, uh, thank you so much for that, too.
[01:51:15] [speaker-0] Uh, and just remember, we will be here, uh, every Wednesday at 12 PM Pacific Standard Time, as always, and, uh, be sure to give us a follow on JavaScript Jam there, and, uh, go
[01:51:25] [speaker-0] subscribe to JavaScriptJam.com on the newsletter there, so you won't be left out necessarily on any of the awesome things coming up.
[01:51:31] [speaker-0] So, With that being said, um, really excited for the future here. We're going to be doing some events.
[01:51:38] [speaker-0] Uh, in fact, uh, one that I will announce, um, we are going to be doing some collaboration with Remix Conference, and, um, we got more to come on that in the near future.
[01:51:50] [speaker-0] Um, and there's a couple more, uh, events as well that we'll be talking about soon. But, um, yeah, I'm excited about the Remix Conference coming up here, um, in the near future.
[01:52:00] [speaker-0] And, uh, we're going to be having some speakers from there come on here as well and join us to just have some great conversation.
[01:52:07] [speaker-0] So keep an eye out for all that. Join the newsletter for more information. All right. Thank you all so much.
[01:52:15] [speaker-0] Really appreciate it. And we'll see you in the next one. Thank you.