---
title: "2022-09-30-widgets-fsjam-40-minutes"
slug: "2022-09-30-widgets-fsjam-40-minutes"
duration: "40:23"
channel: "Local"
url: "docs/benchmarks/stt/sources/2022-09-30-widgets-fsjam-40-minutes.mp3"
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
[00:00:10] [S1] Today is going to be slightly a bit of a different episode.
[00:00:13] [S1] I've been you could say, noodling away on a lot of things in the background on Everfund.
[00:00:17] [S1] One of these subject areas that always comes up that I'm always interested to try and share more about is scripts.
[00:00:24] [S1] When you build a website, you know, if it's a standard blog or even a SaaS app, you're probably going to be installing loads of script by a marketing department if you have one or just by your customers.
[00:00:34] [S1] Maybe that's Google Analytics, Favum, or maybe something more interactive like Intercast.
[00:00:40] [S1] I've been building a script out at Everfund and it has been one hell of a journey.
[00:00:44] [S1] And this is something that I wanted to explore in an episode with Anthony and just really talk over the biggest pitfalls that I've found, the biggest like head scraps scratches.
[00:00:53] [S1] Why do we do it this way?
[00:00:54] [S1] How do you even make a script for your company?
[00:00:56] [S1] It's kind of this black magic that I think nobody's really described a best way of doing.
[00:01:01] [S1] And we've all just kind of made it up along the way.
[00:01:03] [S1] And it all just works because obviously it's JavaScript.
[00:01:07] [S1] But I think it's a really interesting subject area that I wanted to sit down with you and explore.
[00:01:11] [S2] Yeah, this is something I definitely don't know much about.
[00:01:14] [S2] I've never had to write a third party script or really integrate a third party script too much.
[00:01:20] [S2] I've definitely done things with like my dev blog or my hash node blog that would be stuff like that, but they kind of give you the ability to just like plug and play things.
[00:01:30] [S2] I have something that can like track reads and then I get like micro payments or something and I get like $3 a year for my blog posts or something.
[00:01:38] [S2] So I know that there's a lot of these things and they're basically black boxes to me.
[00:01:42] [S1] And the thing is, this is actually what makes it more interesting.
[00:01:45] [S1] The way they kind of can be hosted means that they technically don't have to be open source.
[00:01:50] [S1] They can keep all the source code, obviously how they make the scripts behind their private repositories, and then only give you a bundled version.
[00:01:59] [S1] I've actually seen that with a few and others, like for example, version controlling is another one.
[00:02:05] [S1] There's so many questions here.
[00:02:06] [S1] So I think the best place to start is how do you make a script?
[00:02:11] [S1] How do you make a script that can run on the internet?
[00:02:15] [S1] So outside of your own domain, outside your own website, and it runs some JavaScript on someone else's website.
[00:02:21] [S1] The first step to do that is you gotta work out what you want to write.
[00:02:26] [S1] If you want to write TypeScript or JavaScript, you can bundle further libraries into it, like Svelte and even React if you want to make a really quite heavy script.
[00:02:36] [S1] But if you want something really light, you tend to be using just plain JavaScript.
[00:02:41] [S1] And this is actually really interesting because I found it actually really hard to actually just use plain vanilla Java.
[00:02:49] [S1] JavaScript to build this script because you're so used to abstracted libraries on how to build these things that when you actually have to use the core JavaScript, it really is empowering at the same time.
[00:03:00] [S1] So the biggest thing is you have to start somewhere.
[00:03:04] [S1] And some people have open source scripts.
[00:03:07] [S1] I have mine open source, so you can always look at the source code to this episode, to what I have built.
[00:03:12] [S1] And it first starts with a micro bundler, i.e. a bundler.
[00:03:17] [S1] And that needs to output whatever that JavaScript is.
[00:03:20] [S1] So say it's just, we're going to go really simple and all it is is a function that says hello world.
[00:03:26] [S1] You've tested it and it runs.
[00:03:27] [S1] So then you need to bundle it.
[00:03:29] [S1] How the internet actually works is, as you know, JavaScript can be bundled into multiple different variants from CommonJS to ESM to AMD.
[00:03:38] [S1] But the biggest one, and this is how weird the internet is, is UMD.
[00:03:43] [S1] And this has caused so many problems.
[00:03:45] [S1] So Anthony, do you know what UMD is?
[00:03:48] [S2] I've heard of UMD and I've heard of all of these module things because I've listened to like podcasts like read blog posts about the history of it.
[00:03:56] [S2] It's actually a really good one by Tyler McGinnis that we'll link to in the show notes.
[00:03:59] [S2] But I know that the main thing is that you had a module definition for node, which was common JS.
[00:04:05] [S2] And so that's one that most people were using, because so many people were writing Node, and it was just extremely common to have that kind of syntax.
[00:04:12] [S2] So everything that could work on NPM could work everywhere else.
[00:04:15] [S2] But then you also had things that were meant to work in the browser, which I believe was originally AMD, which was asynchronous module definition.
[00:04:22] [S2] And then that eventually kind of morphed into ESM, which is ECMAScript.
[00:04:27] [S2] And I've heard of UMD, but I thought that ECMAScript is what the browsers were supposed to be implementing.
[00:04:32] [S2] And this UMD repo that we'll also link to that you sent me, no one's even done anything with this since 2017.
[00:04:38] [S2] So I don't really understand how UMD is the standard that's being used.
[00:04:42] [S1] It's really weird because you'll build your script if you're using something like TSDX is what we originally built with, it would spit out two versions, your Common JS and your ASM, and you're like, that's it done.
[00:04:53] [S1] We're done here.
[00:04:54] [S1] We have the script.
[00:04:55] [S1] And then you actually try to load it into a website using one of these interesting loader functions where you like basically have the script on a URL and the JavaScript is basically to inject the script onto the page, asynchronously load it, and then call it to initially.
[00:05:11] [S1] initialize it, what these load scripts are.
[00:05:13] [S1] Every one of them tend to look the same.
[00:05:16] [S1] If you did that with a common JS module, it would just error and say, I don't know what to do.
[00:05:20] [S1] This isn't working.
[00:05:21] [S1] This reference isn't there.
[00:05:23] [S1] That's why you have to actually bundle down to UMD currently.
[00:05:27] [S2] Well, so what would happen if you just did regular ECMAScript, ECMAScript modules?
[00:05:31] [S2] Where would it error there?
[00:05:32] [S1] So CommonJS errored.
[00:05:34] [S1] That's ESM, right?
[00:05:35] [S1] ECMA, is that ESM?
[00:05:36] [S2] No, so CommonJS is the require one.
[00:05:38] [S2] It's one that you do const, declare a variable, and then you do require, then you require the dependency.
[00:05:44] [S2] Whereas ESM, you do import, use the import keyword, and then from, and then whatever you want to import from.
[00:05:51] [S2] And so I would be curious what would happen if you just tried to just write it like you would, like React when you're just like importing stuff like that.
[00:05:58] [S2] That is ECMAScript modules.
[00:05:59] [S2] So what happens if you try and do that?
[00:06:01] [S1] Well, I think the simplest answer is that I don't really know because I don't think I compiled to ECMAScript.
[00:06:07] [S2] We don't need to compile to ECMAScript because the browser just, it's built into the browser.
[00:06:11] [S1] It's built into the browser, yeah.
[00:06:12] [S1] So maybe my big problem here was that I was using TypeScript first is that you've obviously got to bundle out TypeScript, i.e. compile down.
[00:06:22] [S1] This is actually quite an interesting question because this is the thing.
[00:06:25] [S1] ECMA script, I didn't actually try.
[00:06:27] [S1] All my headaches and all my problems all came off of bundling extra modules into the code.
[00:06:35] [S1] UMD obviously works for all browsers, but it is also not deprecated, but we're now leaning more to ESM modules.
[00:06:44] [S1] What you tend to find with a tool like Micro Bundler is that when it bundles the code, it will bundle it to UMD, CommonJS, and ESM.
[00:06:55] [S1] They're the three that it bundles down to, and I don't know why it doesn't bundle down to ECMAScript.
[00:07:00] [S2] No, ESM is ECMAScript.
[00:07:01] [S2] ESM is ECMAScript modules.
[00:07:04] [S1] So it is.
[00:07:04] [S1] So that should work on everyday browsers.
[00:07:08] [S1] And it does, it does.
[00:07:10] [S1] But this is actually a really interesting question as well is support.
[00:07:13] [S1] We did a can I use on ESM modules, and it says to me 93% of the users of the internet can use ESCM.
[00:07:22] [S2] Because IE 11 doesn't support it and then Opera Mini doesn't support it and that's pretty much it.
[00:07:30] [S1] And then obviously earlier versions of Chrome.
[00:07:33] [S1] We're now on Chrome 100 and Chrome 60 was the last one that didn't.
[00:07:36] [S1] So this is also another big question when it comes down to business is when is it okay to deprecate the older version?
[00:07:44] [S1] Because we have a bundled version of ESM.
[00:07:47] [S1] and UMD, and the UMD version is actually bigger in terms of script size because it's using older JavaScript terms.
[00:07:54] [S1] When is the right time to define that you're going to only use ESM?
[00:07:59] [S1] Because this is a script that you need to work every time. 100% of the time you need to work, you need to load your function or your business can't work.
[00:08:08] [S1] Imagine if Intercom only worked on ESM.
[00:08:11] [S1] Well, that's 92% of the website.
[00:08:13] [S1] websites, is 8% of websites it not loading on okay?
[00:08:17] [S1] And that's a really good question.
[00:08:19] [S2] Well, it depends.
[00:08:20] [S2] Would you have the ability to show a message saying this requires Chrome to work?
[00:08:24] [S1] No, I think you'll just arrow and be, like, I can't even compile this JavaScript in the browser.
[00:08:29] [S2] Couldn't you do a polyfill though?
[00:08:31] [S1] Probably.
[00:08:31] [S1] The problem with polyfills is that you also have to bundle that with a script.
[00:08:35] [S1] Oh no, unless you bundle it outside the script.
[00:08:37] [S2] You know, the polyfills add bloat.
[00:08:39] [S2] for sure.
[00:08:39] [S1] Yeah, this is actually a super interesting thing as we're debating all this.
[00:08:43] [S1] When you search how to build a widget, there's hardly any articles out there.
[00:08:47] [S1] Compiling it down, like this was actually really interesting was that when I used MicroBundler, and said output UMD files, it couldn't even do it.
[00:08:57] [S1] It would give you a file that wasn't valid.
[00:08:59] [S1] So then I had to use rollup to specifically make UMD files.
[00:09:03] [S1] I have microbundler creating the bundle for CommonJS and ESM, and then I have Rollup creating the bundle for UMD.
[00:09:11] [S1] Why is this really important?
[00:09:14] [S1] In the world of Everfund, we make a WordPress plugin And that's scary.
[00:09:19] [S1] No, I'm joking.
[00:09:20] [S1] But we need this plugin to work on every website.
[00:09:24] [S1] And this was actually also a massive problem was actually getting it working on WordPress because WordPress did some funky things with it as well.
[00:09:30] [S1] about hosting.
[00:09:31] [S1] So we went with the UMD option.
[00:09:34] [S1] We also chose the option to have an open source.
[00:09:36] [S1] So the source code is open.
[00:09:38] [S1] And then we also hosted it on NPM.
[00:09:41] [S1] So what you tend to see in the industry is that some people will host the script privately, say on an S3 bucket that's cached.
[00:09:49] [S1] You see that with Canny, Intercom, and then you have the other route that is basically using a CDN, an NPM CDN.
[00:09:58] [S1] And have you ever used one of these NPM CDNs?
[00:10:01] [S2] Yeah, just a couple times, like unpackaged.
[00:10:04] [S2] There's actually, there's an ECMAScript one in particular, ESM.SH, I think.
[00:10:08] [S2] They're good for like really simple demos or you want to do something like a code sandbox and you want to pull something without having a build step.
[00:10:15] [S1] Yeah.
[00:10:15] [S1] And this is actually really weird because I feel like we're in between like multiple ways of doing JavaScript.
[00:10:21] [S1] I, you could just NPM install, or you could just load the script in the browser.
[00:10:27] [S1] What is the better way?
[00:10:29] [S1] This is actually a really interesting one because as somebody building a script, you could do either for EverFun.
[00:10:34] [S1] You could install it as an NPM package and import it, or you could just run it from the cloud using the UMD file.
[00:10:42] [S1] And actually, you'd be better to import it into your JavaScript bundle because it would be smaller because using the common JS bundle, not the UMD bundle.
[00:10:52] [S2] So what's stopping you from just taking all of the code and just literally copy pasting it into the script tag on your website?
[00:10:58] [S1] That's an interesting one.
[00:10:59] [S1] What's stopping you?
[00:11:00] [S1] I don't think there is anything stopping you because if it's in UMD, it should technically all run because it's in a format it should work.
[00:11:06] [S1] But you'll then have a really big script that you've got then share to people and be like, Hey, install this 200 line, 300 line script into your website, it's fine.
[00:11:16] [S1] And that's actually the hardest point.
[00:11:18] [S1] What we're doing with all this is trying to create the best developer experience.
[00:11:22] [S1] I want to plug and play.
[00:11:23] [S1] I want to get a chat widget onto my website.
[00:11:26] [S1] What is in your eyes, the most easiest way to get it onto the website?
[00:11:30] [S1] Is that NPM installing it into your React packet, into your React website, and then doing like a JSX component?
[00:11:37] [S1] Is that loading it with a hook is that importing it through HTML and a script tag.
[00:11:43] [S1] This is a really weird thing because there's so many ways to get the same functionality.
[00:11:48] [S1] The next really big thing about it all that I think is actually quite confusing is why do we do it this way?
[00:11:54] [S1] So what I mean by that is we spoke about the problems.
[00:11:58] [S1] I want to be like a verbal tutorial at the same time.
[00:12:00] [S1] You know what I mean?
[00:12:01] [S1] Of like, how do you deal with these things?
[00:12:03] [S2] Sure.
[00:12:04] [S2] If you really want to.
[00:12:05] [S1] I want to give like a compelling episode that talks about this area of like darkness that I've actually like struggled with, but how do you actually make it compelling?
[00:12:14] [S1] You know what I mean?
[00:12:15] [S2] Oh, I'm already compelled.
[00:12:16] [S1] You're compelled.
[00:12:17] [S1] Okay.
[00:12:18] [S1] Okay.
[00:12:18] [S1] This is actually something worth saying.
[00:12:20] [S1] So this is actually a really interesting moment to also talk about is that you've made your script now.
[00:12:25] [S1] How do you demonstrate that?
[00:12:27] [S1] Are you just going to give your customers a HTML version?
[00:12:31] [S1] So saying install it from the CDN.
[00:12:33] [S1] Go.
[00:12:33] [S1] That's one way.
[00:12:34] [S1] And then how about installing it into React?
[00:12:36] [S1] React is also totally different in every way that it works with everything.
[00:12:41] [S1] And what we've found with Everfund is that we've created two SDKs we've created a JavaScript SDK that is Core.js, and then we've created a React SDK that hooks into React.
[00:12:52] [S1] We speak so much about the differences in frameworks, about a virtual DOM.
[00:12:57] [S1] Yep, React does everything differently, so we have to use the virtual DOM.
[00:13:01] [S1] And what we actually find is the common JS library, the JavaScript SDK is only about, I think 2000kB.
[00:13:09] [S1] The React version is like four, five, six megabytes, I think.
[00:13:14] [S1] So much, much bigger.
[00:13:15] [S1] Off the top of my head, I'm terrible with numbers, as we all know.
[00:13:18] [S1] But this is actually where I've been talking about in the past, about learning experiences with other frameworks.
[00:13:24] [S1] how do you then get your script into another framework?
[00:13:27] [S1] So say Vue or Svelte.
[00:13:29] [S1] It's actually quite easy and it's surprisingly simple.
[00:13:34] [S2] Yeah, because they just have script tags and they pretty much just function like HTML pages would unlike React.
[00:13:40] [S1] Exactly.
[00:13:41] [S1] You just install it and then you bind it to a function and it's done.
[00:13:45] [S1] This was actually kind of crazy and speaking about the web as a whole, as in like, when you're building something for your customers, so it's not an experience that you control, say like a dashboard, but something to go on their website, you've got to kind of like mold everything that won't get overridden.
[00:14:02] [S1] I i.e. encapsulated, i.e.
[00:14:04] [S1] CSS, functions, variables.
[00:14:07] [S1] You then need to make sure that it can be imported into frameworks of choice in the best way possible.
[00:14:14] [S1] You also then need to make sure you have like a UMD version that could be imported into things like WordPress websites, websites that don't use a lot of JavaScript.
[00:14:23] [S1] And all this starts to look like a really big puzzle on how do you actually do it.
[00:14:28] [S1] The first step, how we did it in Everfund is we wrote a class with a new, so new class.
[00:14:34] [S1] What that has is every single option that we wanted to run inside of it, such as watching a ID click.
[00:14:43] [S1] So for a button, say if you put an ID of like open pop up, we'd watch that ID.
[00:14:48] [S1] When it gets clicked, we would then hijack that click and run all of our custom functionality.
[00:14:53] [S1] That was necessarily quite easy, but actually the hard part that actually took longer was working out the CSS solution.
[00:15:00] [S1] Before I speak about CSS solution, if you was to inject, say, some code onto another website, how would you think about doing it?
[00:15:07] [S1] I you're going to run, say, a form.
[00:15:10] [S1] We'll make it easy, a form.
[00:15:11] [S1] How would you inject a form onto a website?
[00:15:15] [S2] You use Netlify forms.
[00:15:16] [S1] So you're going to use Netlify forms.
[00:15:17] [S1] So you're going to load an iframe.
[00:15:20] [S1] And this is actually really interesting.
[00:15:21] [S1] What is the better strategy?
[00:15:23] [S1] Do you build the form out of HTML on the web page so you're actually building into the DOM?
[00:15:30] [S1] Or do you iframe Tarshan at user vitals has done the opposite to me, I believe.
[00:15:38] [S1] So in my web app, we use iframes, it loads our Next.js website, but Tarshan's user vitals, I believe build the actual content into the web page.
[00:15:50] [S1] So you have multiple more complexes.
[00:15:52] [S2] Until Portals comes out.
[00:15:54] [S1] Until Portals.
[00:15:55] [S1] This is also the savior of everything.
[00:15:57] [S1] Portals, whenever that will be.
[00:15:59] [S2] And check out episode nine for more on Portals.
[00:16:02] [S1] The biggest problem to this is communication to your server.
[00:16:06] [S1] So say if you're going to send an API call, it could be cause blocked if you use the method built into the website's DOM because you were then sending a web call from that URL, if that makes sense.
[00:16:19] [S1] But if it's an iframe, it doesn't get course blocked because it's working inside that website.
[00:16:25] [S1] So what's the pros and cons to each?
[00:16:27] [S1] When it's an iframe, you tend to have a lot less of a JavaScript bundle, i.e. what you're building, because really what you're then building in your script is a way to put an iframe on the page, open it and let the website inside render.
[00:16:42] [S1] And that's actually, you know, good enough for most use cases.
[00:16:45] [S1] And it was in Everfunds donation widget.
[00:16:47] [S1] So what do you gain and what do you lose?
[00:16:50] [S1] What you gain is that you control the website.
[00:16:53] [S1] Every time the website changes, you don't have to push a new version of the script publicly.
[00:16:59] [S1] You just update the website because you know the loader doesn't change.
[00:17:02] [S1] But then if a user wants to customize, say, CSS on how that form was going to look, then it's going to be impossible because you can't edit CSS inside an iframe.
[00:17:15] [S1] That's when you would then have to put CSS, like a CSS import into your website that could then allow them to inject their own CSS.
[00:17:24] [S1] So you see that there's, it's not an easy picture no matter what you pick and providing a really good experience is really, really hard.
[00:17:33] [S2] So why is there not a startup trying to fix this problem?
[00:17:37] [S1] Interesting.
[00:17:37] [S1] Why is there not a startup?
[00:17:38] [S1] Because it's kind of like half web standards, I think.
[00:17:41] [S1] But also, do we all know the correct abstraction?
[00:17:45] [S1] Is there a correct abstraction?
[00:17:46] [S1] We also kind of maybe seen this in other people's work as well.
[00:17:51] [S1] We recently had a person on from Quick yesterday, and he was saying, that he is building a language that can compile to any language, i.e. to web and all these other things, depending on the framework.
[00:18:04] [S1] There's all these aspects out there as like multiple deployment targets.
[00:18:08] [S1] but actually doing it.
[00:18:10] [S1] Maybe a SaaS startup is too much and it's actually we should just have a really good starter that's really highly starred on GitHub that everybody just uses.
[00:18:20] [S2] Sounds like something you can do.
[00:18:21] [S2] after all this stuff you've done.
[00:18:23] [S1] Potentially yes.
[00:18:25] [S1] Everfunds donation widget is not actually done.
[00:18:27] [S1] Our SDK, we're actually just starting our SDK.
[00:18:30] [S1] Our SDK today is just opening our donation widget in an iframe.
[00:18:34] [S1] But what we're moving to right now and what we're building on is extending that into a headless donation system.
[00:18:40] [S1] So that then will allow anybody to completely build their own UI on top of all of our functionality.
[00:18:47] [S1] And then what we've turned our SDK into is this script that one loads a script, two initializes classes that will then be allow you to create and take donations for charities in a headless way.
[00:19:00] [S1] And what that involves is extending the classes functions to then do rest calls as well.
[00:19:06] [S1] Not too hard.
[00:19:08] [S1] The big thing about all this is that they're very core functions.
[00:19:12] [S1] I, you know, I might do a rest call on an API click or load an iframe.
[00:19:16] [S1] But the way web standards is, it all can get really muddy, really fast because there's so many ways of doing anything, if that makes sense.
[00:19:25] [S1] Like what's the right way?
[00:19:26] [S1] What What's the right way to create a script?
[00:19:28] [S1] This is a really good question.
[00:19:30] [S1] Where would I say start?
[00:19:31] [S1] I would be nice and I'll say probably go look at Everfun's JavaScript SDK because we actually open source it.
[00:19:38] [S1] So you could bundle it yourself.
[00:19:40] [S1] And then second, we've made loads of examples that has it bundled in.
[00:19:43] [S1] So you can actually try it and then build one for yourself off of it.
[00:19:47] [S1] That's what I'd say would be a great first step is because I've gone through a lot of headaches getting that to this point that it actually bundles and works on every single browser, every single web platform.
[00:19:59] [S1] We had problems where our donation widget just would not work on WordPress.
[00:20:05] [S1] The code would be there, the script tag would be in the page and it just wouldn't work.
[00:20:09] [S1] And we was like, is this a JavaScript problem?
[00:20:11] [S1] Is this a WordPress problem?
[00:20:13] [S1] You know, you're looking at the code and what made it weirder is that it worked on some WordPress website.
[00:20:18] [S1] websites, but not others.
[00:20:19] [S1] And you're like, why is it doing that?
[00:20:21] [S2] Because there's different versions of WordPress and some people let their WordPress sit forever and never update it.
[00:20:27] [S2] And other people are like, well, I need to update it because it has nine vulnerabilities in it now.
[00:20:30] [S2] And that's why you're going to have a huge spread of different types of WordPress sites.
[00:20:35] [S1] Yeah, this was the latest version of WordPress.
[00:20:38] [S1] So almost identical websites.
[00:20:40] [S1] The solution to this was actually not to call a JavaScript CDN, but to host the script inside the WordPress instant.
[00:20:50] [S1] It almost was like the WordPress instant was blocking the script communicating with the web.
[00:20:56] [S1] It was really weird edge case that we managed to solve by bundling the script inside the WordPress tag.
[00:21:02] [S1] Really, you could say this was a real 20, 25 minute ramble.
[00:21:06] [S1] There's also other subjects that I did want to talk about in this episode for sure.
[00:21:10] [S1] Where do you go and how do you start and what to do?
[00:21:14] [S1] Because I think so far the evolution of FSJam has been, we've been speaking to so many frameworks, advocates, and we love doing all them things.
[00:21:26] [S1] But me and Anthony also love to chat to each other and just talk about technology.
[00:21:31] [S1] I feel like we need another deep dive without a guest to talk about the block.
[00:21:36] [S1] blockchain again.
[00:21:37] [S1] Now that you work at a web three company, just really trying to explain it, really try and make it easy.
[00:21:42] [S1] Not necessarily every episode is going to now just be me and Anthony, but I think it'll be great once in a while to try and start exploring other subjects, let other people maybe learn from these subjects.
[00:21:53] [S1] You know, if there's a subject you want us to talk about, potentially ask us.
[00:21:56] [S1] Another good subject I think to talk about, this can be just ourselves or it could be someone else with us, is documentation.
[00:22:03] [S1] You've wrote a lot of documentation, but how do you write good documentation?
[00:22:07] [S2] Oh God.
[00:22:08] [S2] Yeah.
[00:22:08] [S2] That's a huge one.
[00:22:09] [S1] Exactly.
[00:22:10] [S1] Say you're a SaaS product.
[00:22:11] [S1] You wrote your SDK that we've just been speaking about, and now you need to document it.
[00:22:16] [S1] How do you document it?
[00:22:17] [S1] Well, we've had Docasaurus on, we've had Tanner Lindsay on.
[00:22:22] [S1] These two people build really good documentation separately.
[00:22:26] [S1] A Docasaurus builds the website, Tanner Lindsay built his own.
[00:22:29] [S1] But actually, how do you write really good documentation?
[00:22:32] [S1] And actually how do you get people to understand it?
[00:22:34] [S1] That's one thing I want to sit down and really ask you one day.
[00:22:38] [S2] I agree.
[00:22:39] [S2] And it's something that there's no dark specification, but there is a docs system, Divio, I think it is.
[00:22:45] [S2] They break it down to tutorials, explanation, reference, and how tos.
[00:22:52] [S2] And I remember I came up with kind of my slightly different namings for this, because I think that tutorials and how to sounds like the same thing to people.
[00:22:59] [S2] So that's a little confusing.
[00:23:00] [S2] The main thing is that you'll have a reference would just be like an API reference.
[00:23:04] [S2] So you have every single method you can call and then everything that it takes.
[00:23:07] [S2] And it's just like pure information.
[00:23:09] [S2] And then you have explanation would be like this, what we're doing here in a podcast, like explaining something just kind of in like prose or normal language, maybe with or without some code exam.
[00:23:19] [S2] examples.
[00:23:20] [S2] And then a how to guide would be how to do something specific.
[00:23:25] [S2] So like for Redwood, this would be like, how do you connect Redwood to file storage?
[00:23:29] [S2] Or how do you make a third party API call?
[00:23:31] [S2] And then tutorials is something that is meant to teach you something as you go throughout the processes, like the Redwood tutorial.
[00:23:40] [S2] At the end, you don't really have like a quote unquote production app that really does anything that fancy, but it gets you to understand the entire framework along the way.
[00:23:49] [S2] So I think that's a pretty good way to separate the different types of documentation you can write.
[00:23:54] [S2] And then you want to make sure those categories are then easily represented on your actual doc site so people then can navigate and know how to find things.
[00:24:04] [S1] Yeah, documentation is, as you just said, is this really, really big thing and I ever fund.
[00:24:09] [S1] We tried Docosaurus we tried rolling our own solution, but now we're actually using readme.
[00:24:15] [S1] Have you heard of readme?
[00:24:17] [S1] readme.io.
[00:24:18] [S2] I've heard of it.
[00:24:18] [S2] I know there's like, there's GitBook also.
[00:24:21] [S2] There's there's a lot of these.
[00:24:22] [S2] I have not used readme myself, but I think it's one that if I saw it, I would recognize like the look because I read so much documentation.
[00:24:29] [S1] Yes.
[00:24:29] [S1] Well, we're using it with Everfund.
[00:24:31] [S1] This is actually something that I think is super, super important is like with that, we're building a open REST API for Everfund as well.
[00:24:38] [S1] So that's built into the documentation.
[00:24:40] [S1] And finding a documentation platform that makes the Rest API documentation look as good as the actual rest of the documentation is something by itself.
[00:24:51] [S1] I think the real top level of documentation is Stripe.
[00:24:54] [S1] We could all want to be like Stripe, but they obviously spend a lot of money being like that.
[00:24:58] [S1] There's so many subject areas that we always want to talk about.
[00:25:02] [S1] And getting around to them is a really big question.
[00:25:06] [S1] Something that we have coming up, we're both going to Utah for remix conference.
[00:25:12] [S1] How are you feeling about that, Anthony?
[00:25:13] [S2] Oh, I'm stoked.
[00:25:14] [S2] Yeah, there's going to be a lot of people there.
[00:25:16] [S2] that I know, Michael Chan, Ishaan, both of which have been on the show, and then Austin Crim, who works at Prisma, we'll be hanging out with him for a bit, some other people as well.
[00:25:27] [S2] Yeah, so I'm looking forward to it.
[00:25:28] [S2] I am not going to be speaking.
[00:25:32] [S2] I won't be like really doing much quote unquote like work stuff.
[00:25:35] [S2] It won't be really like a work conference for me.
[00:25:38] [S2] So yeah, I think it'll be fun.
[00:25:39] [S2] And then my girlfriend's going to be there as well.
[00:25:41] [S2] So Jen, we'll get to meet a lot of my friends, which will be cool.
[00:25:44] [S2] We'll get to meet her.
[00:25:45] [S1] That'd be very cool.
[00:25:46] [S1] My partner is very jealous that I'm going to the United States.
[00:25:49] [S1] I'm sadly taking my business partner instead of my actual partner, but she's going away to a five star resort in Greece instead.
[00:25:58] [S1] So I'm sure she's not missing out that much.
[00:26:01] [S1] Something else that I quickly wanted to talk about on air is how we feel about the podcast.
[00:26:08] [S1] where it's going, and also how we feel about always having guests on.
[00:26:12] [S1] I've not broked this conversation with you before having this conversation, but I think it's actually quite cool to have it very open, very, you know, have your thoughts in the air.
[00:26:22] [S2] Yeah, I mean, I enjoy these episodes.
[00:26:23] [S2] I was saying the last time we did this that I wish we did these more often.
[00:26:27] [S2] So yeah, I can see us doing this maybe like once every other month or something like that and then get a good cadence because the main thing is just like, there's so many guests that we would like to have on, so we always want to like keep space for them.
[00:26:38] [S2] And then I think listeners will get value from our conversations, but they'll also get a lot of value from being exposed to new projects and new people and their ideas, because if you've been listening to us for a while, you probably will know our opinions about a lot of things at this point.
[00:26:54] [S2] But there is still stuff that I think that we could probably talk about that we haven't really doven into too much.
[00:26:59] [S2] But yeah, and I think something else that you probably were getting to here is that we're considering sponsors for the first time.
[00:27:05] [S2] And so it's likely that we'll be bringing on some different companies and having just a short little ad read in the beginning of the show that you're welcome to skip if you want.
[00:27:14] [S2] But it's going to really make this a lot more sustainable for us because it's something that we've been both doing is a labor of love, really, myself especially, putting quite a few hours each week on it to make it happen.
[00:27:26] [S2] So that is something that I have hesitated to do.
[00:27:30] [S2] But I think as long as there are companies that I feel confident promoting, then I think I won't feel too bad about it.
[00:27:37] [S2] And then listeners can skip it if they want.
[00:27:39] [S2] It's very easy to fast forward commercials and podcasts.
[00:27:42] [S2] So yeah, if people have any ideas of who we should sponsor or anything like that, feel free to shoot us a message on Twitter and let us know.
[00:27:49] [S2] Those will likely be coming in the next couple of weeks or a month.
[00:27:53] [S1] Yeah, and this is something that I wanted to ask.
[00:27:56] [S1] What's your opinion on having products, frameworks on the podcast that you could openly endorse?
[00:28:04] [S1] are the episodes we have where one of us is so far deep in the area, almost alienating, if that makes sense.
[00:28:13] [S1] So what I mean is let's take an area, something that we're both really, really knowledgeable.
[00:28:17] [S1] at and say Redwood.
[00:28:19] [S1] So if you listen to our episodes about Redwood, we say it's the best thing ever.
[00:28:22] [S1] You're never going to have a problem and you should go out today and you should build in Redwood.
[00:28:26] [S2] No, we don't say that.
[00:28:27] [S2] I specifically don't say I'm a responsible advocate now.
[00:28:30] [S2] I'd never say that.
[00:28:31] [S1] Responsible advocacy, that's more what I'm trying to get at is when it comes to sponsorships, when it comes to people who are coming onto the podcast, developer advocacy is a lot of the people we get on.
[00:28:44] [S1] And yes, they are trying to get you to understand their product, understand what they're doing, and also give some value.
[00:28:51] [S1] So as a developer advocate yourself, we kind of sit on both ends.
[00:28:55] [S1] I'm a founder of a company you're a developer advocate.
[00:28:57] [S1] How do you feel about almost having these episodes being, you know, pitches?
[00:29:02] [S1] All these guest episodes, are they pitches in your eyes?
[00:29:06] [S1] Or are they you want to learn something without necessarily buying the product.
[00:29:10] [S2] So if you're doing DevRel correctly, you are always educating first, and then the awareness is downstream of the education.
[00:29:18] [S2] So that's why the types of advocates that I bring onto this show, they are always going to be associated with a framework or a product or something that they are there to talk about.
[00:29:28] [S2] That's the whole point.
[00:29:28] [S2] We have an episode about a subject, usually not about a person.
[00:29:32] [S2] But if they actually are trying to lift up the developer community and not just shill their thing, then DevSode will still be valuable.
[00:29:41] [S2] So for me, I haven't had much problems with this because I have had a pretty good handle on who are the advocates out there and who could we invite on?
[00:29:50] [S2] Because many of the people who have found this show, I've listened to them do like ten podcasts before, you know?
[00:29:54] [S2] So I had a pretty good idea of who I would feel comfortable bringing on.
[00:29:59] [S2] And most of the products, you know, were things that I'd already used, or at least tried or felt pretty confident about.
[00:30:04] [S2] I think I've had a fairly good track record on that for the most part.
[00:30:09] [S2] And I feel good about the sum total of both guests here and stuff I've written about.
[00:30:14] [S2] The only thing I can think of that I really regret having ever promoted and like actually deleted my blog post by it because like I don't want anyone to like read this and find this is quovery.
[00:30:24] [S2] I will officially renounce quovery because their platform is completely broken, they have no support, and then they basically put you in a position where you have like $100 Kubernetes bill and you have no idea what to do.
[00:30:34] [S2] It's a nightmare.
[00:30:35] [S2] Do not ever use it.
[00:30:36] [S1] And that's the thing of, as we just spoke about making the podcast, more sustainable.
[00:30:41] [S1] When it comes to advertisements, should every word come out of our mouth be believed to get a podcast advertisement on?
[00:30:49] [S1] Should we have used the product?
[00:30:51] [S1] Should we know the product?
[00:30:53] [S1] Or is it okay to just recommend the product from a podcast?
[00:30:56] [S1] These are bigger questions than I think just our podcast and many podcast hosts have these kind of questions.
[00:31:02] [S1] But what's your thoughts on that?
[00:31:03] [S1] I somebody comes along, you've never heard of their tech company.
[00:31:07] [S1] Well, you've heard of it, but you've never used it yourself.
[00:31:10] [S1] And they're like, we'll give you some money.
[00:31:12] [S1] You go give us your listeners.
[00:31:14] [S1] How does that feel to you?
[00:31:15] [S2] Yeah, and this is something that comes up significantly more in the blog.
[00:31:19] [S2] blockchain web three world, because there's so much money floating around.
[00:31:21] [S2] People want to get their stuff out there so much.
[00:31:24] [S2] So the question of trust is huge here.
[00:31:26] [S2] And how do you know whether to trust someone?
[00:31:29] [S2] How do you signal trust?
[00:31:31] [S2] And for me, because I already going back to last thing, I said, I already knew the ecosystem really well.
[00:31:35] [S2] So I already had a good handle on who to trust.
[00:31:38] [S2] But then if anyone ever came to us who we'd never heard of, usually I would just, you know, talk to them for a little bit and then I would check out their product.
[00:31:45] [S2] If they had other material, I would check that out.
[00:31:47] [S2] And usually I'll get a sense just from kind of chatting with people whether they knew what they were talking about and if they were going to be a good guess.
[00:31:53] [S2] Like Jake Ginnivan is a good example here.
[00:31:55] [S2] Like I'd never heard of Jake's product.
[00:31:57] [S2] It was you know, the feature flag one.
[00:31:59] [S2] And he just kind of messaged me out of the blue on the Jamstack Slack, rest in peace.
[00:32:04] [S2] And he was just like saying, yeah, I really like the podcast.
[00:32:06] [S2] He was like talking about and he was talking about his past and how he did all this like SSR stuff for this, you know, like Australian news company.
[00:32:12] [S2] And very quickly I was like, all right, this dude like knows what he's talking about.
[00:32:15] [S2] This guy's a very, very experienced engineer.
[00:32:17] [S2] So yeah, you just gotta like take enough time to actually like vet someone and just like do a gut check on someone.
[00:32:24] [S2] If you are already experienced and you know what to look for and you know the telltale signs, that shouldn't take you too long.
[00:32:31] [S2] But you got to do at least some kind of baseline level of vetting before you just like let anyone come on.
[00:32:36] [S2] your podcast.
[00:32:37] [S2] And that's partly what our job is to make sure we don't just bring anyone on to the podcast, let them say anything to you because we think that having our listeners value our opinion and what we choose to bring to the podcast is really important.
[00:32:48] [S1] And that's why we're having this conversation on air.
[00:32:50] [S1] It's not only our opinions, it's also your opinion as the listener.
[00:32:54] [S1] What do you think about this?
[00:32:55] [S1] What do you think about the future?
[00:32:57] [S1] Me and Anthony both want to make FSJAM as sustainable as possible.
[00:33:00] [S1] One of my favorite podcasts ever Hello Internet had the kind of opinion of it's up to the co-host.
[00:33:06] [S1] You choose to listen or you don't.
[00:33:08] [S1] You don't have a choice.
[00:33:09] [S1] If they want to quit podcasting and never do another episode, that's it.
[00:33:13] [S1] And it is a relationship.
[00:33:15] [S1] Who do I have a relationship with when I think about a first jam?
[00:33:18] [S1] Do I have a relationship with Anthony or do I have a relationship with me, Anthony and also the listeners?
[00:33:24] [S1] Are they part of the relationship?
[00:33:25] [S1] Do they matter?
[00:33:26] [S1] And the answer is to me, the more we go on and the more people that I speak to say, I know about the podcast, I've listened to the podcast, it's building that relationship with people.
[00:33:36] [S1] And it's kind of about, you could say it's weird about celebritism, about having one sided relationships.
[00:33:42] [S2] That's called a parasocial relationship is a great term.
[00:33:46] [S1] Yeah, a parasocial relationship.
[00:33:48] [S1] Paralela.
[00:33:48] [S1] But as I was saying, it's like, I want to make the podcast as sustainable as possible.
[00:33:54] [S1] Something I'm interested in is that when we go to Utah, I've actually ordered me and Anthony FS Jam t shirts.
[00:34:00] [S1] Is this something the listeners are interested in?
[00:34:03] [S1] Would you want us to spit out a teespring shop so you could buy an FS Jam t shirt?
[00:34:07] [S1] to support the podcast.
[00:34:08] [S1] Advertisements, we're going to start looking at sponsorships as a way to make FSJam more sustainable.
[00:34:15] [S1] And the biggest part of it is obviously Anthony.
[00:34:18] [S1] Anthony has edited every single podcast from day one.
[00:34:22] [S1] And I'm forever grateful of that.
[00:34:24] [S1] And I fully should expect Anthony and your time to be not necessarily paid, but to be respected, compensated yes, because that makes everything more sustainable in this world.
[00:34:36] [S1] When you're doing something for free, it's a lot harder to prioritize it.
[00:34:40] [S1] And I think that is very, very important.
[00:34:43] [S1] But before we close this out, what's been your favorite episode in the last few months?
[00:34:47] [S1] What's been your highlight since we've last done one of these episodes?
[00:34:51] [S2] That's a good question.
[00:34:53] [S2] I liked the Hydrogen episode.
[00:34:56] [S2] That was a really interesting one because I didn't know anything about.
[00:34:59] [S2] it and I had never used it, but I knew that if Shopify was putting together some sort of open source project, it probably would be pretty legit.
[00:35:06] [S2] And then Josh is someone who really had a lot of fantastic open source experience and he had a lot of great stuff to say.
[00:35:12] [S2] And then it wraps into like the server component stuff, which we've been talking about since the show almost started.
[00:35:17] [S2] So there's a lot of interesting kind of long term trends that were represented by that episode and just the fact that no one has done a podcast about hydrogen yet.
[00:35:26] [S2] That's one of the things that when I started this podcast, I really wanted to do is I wanted to get people on to talk about subjects that hadn't even been talked about yet on a podcast.
[00:35:35] [S2] It's the same thing with Marco.
[00:35:36] [S2] So I think that having the ability now and having a platform to bring someone on, like being able to see the projects that are coming up and be like, Hey, this is something that's going to be important and consequential and people need to know about, I can just reach out to that person and say, Hey, come on my podcast.
[00:35:50] [S2] And it's pretty much a guaranteed yes at this point because we have like such an established lineup of guests that we have pretty much everyone can go look at it like, oh yeah, these guys look pretty legit like, well, they had Ken C.
[00:35:58] [S2] Dawds on.
[00:35:58] [S2] So it obviously is a real podcast.
[00:36:00] [S2] And yeah, I would say I like the flight control episode as well because I also feeds into a lot of the things we've been talking about, about deployments and how do you actually get a full stack Jamf Stack application online.
[00:36:11] [S2] I think those are probably my two best recent favorites.
[00:36:15] [S1] I really like seeing the journey of Brandon and the core contributors of Blitz.
[00:36:21] [S1] This has actually been really interesting.
[00:36:23] [S1] You could say that our roots of the podcast was Redwood JS and Blitz.
[00:36:26] [S1] They're these two brand new things, but we've seen Redwood double down and excel at what they've been doing.
[00:36:32] [S1] And we've seen Blitz evolve and move into this new standard.
[00:36:37] [S1] We've seen Simon get hired by Netlify.
[00:36:39] [S1] We've seen Brandon start his own company and being Y Company.
[00:36:42] [S1] combinator.
[00:36:43] [S1] This is like super exciting.
[00:36:45] [S1] It's amazing to see how everybody's growing.
[00:36:47] [S1] One of the latest episodes we've done that I actually think wow every time is Autor and Ken C Dodds.
[00:36:55] [S1] Ken C Dodds, he's an inspiration to us all in terms of learn and teaching React and JavaScript and obviously Remix.
[00:37:02] [S1] That was the conversation that persuaded me to go to Remix conference.
[00:37:06] [S1] And then second to that is Autor.
[00:37:08] [S1] Autor's work worked on the TypeScript team for so long, very, very knowledgeable, and he's really is a great resource and always willing to help people as well.
[00:37:19] [S1] So they were two of my highlight episodes from the last few we've done.
[00:37:23] [S1] Anything else you want to talk about before we close this one out of this massive Ramble episode?
[00:37:28] [S1] It's kind of like a toy box of just fun things that we want to speak about.
[00:37:32] [S2] Yeah, that's like most of the episodes that we do together usually end up turning into.
[00:37:37] [S2] No, nothing else from me, just that we appreciate all the listeners who continue to listen to us.
[00:37:43] [S2] I know that there's a decent chunk of people that I hang out with on like Discords who like to listen to this.
[00:37:48] [S2] So that's really great.
[00:37:49] [S2] And I'm always wishing that I could put more time into this and really get it on a better cadence.
[00:37:55] [S2] But it's been tough, especially as I've been like transitioning into my new job.
[00:37:59] [S2] But hopefully we can get ourselves to a point where we're at least like consistently putting out an episode every week, because as I've dropped the ball in quite a few weeks over these last couple of months.
[00:38:07] [S2] But we're also creating content for the long run.
[00:38:10] [S2] Like these are episodes that I think are just as valuable to listen to like two years after the fact, because even if the tech changes, the concepts stay the same and the progression of how these things go is important as well.
[00:38:22] [S2] I think that even if you're listening to a podcast about a technology that is not being used anymore, it can be useful to listen to because it can give you a better context of why are things the way they are now today.
[00:38:36] [S2] And that is really the goal for me with doing stuff like this is creating a kind of historical record for people who are going to be coming to web development for the first time years from now, and are trying to figure out what the heck is going on, what any of this stuff is, and why they need to know about UMD and AMD and CJS and ESG ESM and what any of that crap means.
[00:38:54] [S2] So yeah, feel free to just, you know, hit us up on the Twitters fs jam org if you ever want to get in touch with us or suggest a topic or ask if you can speak on the podcast.
[00:39:05] [S2] We're always open.
[00:39:06] [S2] As you're saying, we'll kind of check you out and make sure you're legit, but we're really open to anyone being on here and talking about what they're doing if you're working on something interesting.
[00:39:14] [S1] The final thing I can say, I can't believe we've got Mishko on, and we didn't even speak about Angular ones.
[00:39:20] [S2] Yeah, I kind of wanted to, but it was like quick is such an interesting dense topic that I didn't want to kind of detract from it too much.
[00:39:26] [S2] But yeah, like he's a legend and he's someone who has done very consequential work on just JavaScript that has affected all of us.
[00:39:34] [S2] So yeah, that was awesome.
[00:39:35] [S2] It was really, really cool to have Mishka on.
[00:39:37] [S2] Thank you to Ryan for making that connection for us.
[00:39:40] [S1] Yeah, that's it for now.
[00:39:41] [S1] Until we speak again.
[00:39:43] [S1] Bye.
[00:39:43] [S1] Bye.
[00:40:09] [S1] Cool.
[00:40:16] [S1] I'm sure you can edit that into something decent.
[00:40:21] [S2] Oh yeah.