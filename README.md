# Gravity
Gravity is a slack app that uses machine learning to take each new question asked in Slack and compare it to previously asked questions, look for a possible answer to reccomend for the new question. Our assumption being that enough repetitive questions exist that Gravity would be used quite often. 

We learned a few things that lead us to shut down Gravity: most people prefer to ask questions to a teammate or manager, in bigger slack channels most questions while semantically similar have different answers each time, and there just aren't enough repetitive questions asked in channels.

At peak, Gravity had ~400 users and ~60,000 events hitting the system per day.

## Inspiration
With Gravity we attempted to reduce the time it takes for employees to get the information they need to do their job. As most of these conversations have moved from email and in person to apps like Slack or Teams, we believed we could build a solution that lived in these platforms to reveal information that was previously lost to the void.

## What we learned
From an engineering standpoint, we learned a ton about working with the Slack API, building scalable AWS cloud architecture, machine learning, writing clearn layered code, and programming in Typescript.

From a entrepreneurial standpoint, we learned the importance of product market fit, finding and building for power users, identifying pain points, validating a business idea, and the world of venture capital.

## Tech Stack
* Typescript
* Python for ML
* AWS Aurora
* Dynamo DB
* AWS

## Accomplishments we are proud of
* Building a system and database that was able to handle ~60,000 events per day
* Scaling to beta testing with 2 companies and ~400 users
* Implementing a machine learning model to identify similar questions with high precision
* Able to build this app in 4 months of part-time work.
