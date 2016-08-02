# COBI challenge

## General Notes
- "The location data of the GPX file should be stored in a database". I will assume that I can discard the metadata of the gpx files
- "stored in a database of your choice (MySQL, MongoDB)". Given the similarity of the task with the value proposition of COBI, I will asume that this will later be expanded to work with additional information. Since modifying Tables in SQL statements and porting the data can be very troublesome, I will use a NoSQL database to store the information.
- GPX files can contain different kinds of location data, thus a single location search would be insufficient. Two options come to mind:
  - split the data into its normalized components and link them all together with an id.
  - store the data as a single document and adapt the search-indexes based on what we are looking for
- The former alternative is very similar to SQL databases, which would introduce rigidity and possible future migration problems, specially for a startup product where the complete structure is not clear yet. I chose the later alternative as several NoSQL databases provide a way to search based on indexes that the user can configure even after the information has been already stored.

## Implementation Notes
- The task is not complicated enough to use a framework such as strongloop.
- All but one function are provided by 3rd party libraries, thus unit testing is not *really* needed. It could be used, but at this stage, the postman test suite provides more information that a single function unit test could do.
- There is no specific restriction to either how close should the gpx documents be nor how many of them should we return. Given that this runs on a local machine with not a lot of data, I will leave those open but it should be taken into account if this is put into production.
- There is no clear way to distinguish two gpx files without storing the full content. Nevertheless, that's generally not appropiate since xml files are not easily searchable. In the absense of a clear way to distinguish the content, it is possible for the database to contain duplicated information. I will leave this open assuming that something like a user-id + timestamp could be provided by COBI.

## TASK
- Create a Node.js HTTP server with Express
- Create an endpoint that allows to upload a GPX file (no need for a frontend – you can use postman)
- The location data of the GPX file should be stored in a database of your choice (MySQL, MongoDB – it's up to you which db and format you pick)
- Create another endpoint that allows to pass in a location (lat, lon) which returns the GPX files ordered by distance to the parameter
- Use postman (getpostman.com) to create a test suite for your endpoints
- Create unit tests where appropriate
- Upload the project to github or bitbucket
