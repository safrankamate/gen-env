# genvy

Generate .env files from JSON templates.

1. [Example Walkthrough](#example-walkthrough)
2. [Configuration Reference](#configuration-reference)
3. [Template Reference](#template-reference)
4. [Value Reference](#value-reference)
5. [Secrets File Reference](#secrets-file-reference)

# Example Walkthrough

Imagine you're working on a project that includes two Docker containers:
one for a Postgres database, and one for a NodeJS backend. In order to avoid
hardcoding things like database usernames and passwords, and other configuration
options, you'd like to create `.env` files for both of these. Here's an
exmaple of what they might look like:

**`.env` for the SQL container:**

```env
POSTGRES_USER=db_user
POSTGRES_PASSWORD=guest
POSTGRES_DB=app_db
```

**`.env` for the NodeJS backend:**

```env
DB_HOSTNAME=localhost
DB_USERNAME=db_user
DB_PASSWORD=guest
DB_NAME=app_db

COOKIE_VALIDITY=2592000
COOKIE_SECRET=TopSecretCookie
```

As you can see, several pieces of information are shared across multiple `.env`
files, which must be kept in mind when maintaining the project. You'll also
most likely want to create different configurations for your development and
production environments; the latter, especially, with stronger passwords.

Here's how you can use Genvy to accomplish this.

## 1. Install the Package

If you install Genvy globally, you can then run it directly from the command line:

```bash
$ npm install -g genvy
```

If you install Genvy locally, make sure to save it as a devDependency, and
add a script to `package.json` to run it:

```bash
$ npm install -D genvy
```

```json
package.json

{
  "scripts": {
    "genvy": "node node_modules/genvy"
  }
}
```

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 2. Create a Configuration File

To use Genvy, you will need to create a configuration file called `genvy.json`.
It's easiest to put it in the root of your project, though this isn't mandatory.

Throughout this example, we're going to assume our project folder structure
is as follows:

```
/
  sql/
    env.json
  backend/
    env.json

  genvy.json
```

The `sql` folder contains the various files pertaining to our Postgres container,
and the `backend` folder is the same for the NodeJS container. This is just an
example, and your project might have completely different folders.

With that said, our configuration file will start out something like this:

```json
genvy.json

{
  "files": {
    "postgres": {
      "source": "sql/env.json",
      "target": "sql/.env"
    },
    "node": {
      "source": "backend/env.json",
      "target": "backend/.env"
    }
  }
}
```

Let's break this down.

- Each configuration file MUST contain a **`files`** block.
- The keys of this block can be arbitrary identifiers. These are the
  **template names**.
  It's recommended to pick ones that reflect the purpose of the `.env` file.
- Each key within the `files` block MUST hold an object, which in turn MUST
  contain a `source` and a `target` key.
- The `source` key should hold a path to a file that will be used as the
  template for the generated `.env` file. If it's a relative path, it should
  be relative to the location of the configuration file.
- The `target` key should hold a path to the `.env` file we want to generate
  based on the JSON template.

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 3. Create the Template Files

In order to generate our `.env` files, we'll need to create JSON templates
to base them on. We've already indicated in the folder structure that we're
going to place an `env.json` file in each of our `sql` and `node` folders.
The template files can have any name and extension, but `env.json` is
recommended as a convention.

We're going to start with two very basic templates, and gradually work on
them to take advantage of Genvy's features. Here's what each of them look
like at first:

```json
sql/env.json

{
  "postgres_user": "db_user",
  "postgres_password": "guest",
  "postgres_db": "app_db"
}
```

```json
backend/env.json

{
  "db_hostname": "localhost",
  "db_username": "db_user",
  "db_password": "guest",
  "db_name": "app_db",

  "cookie_validity": 2592000,
  "cookie_secret": "TopSecretCookie"
}
```

As it stands, we've literally just copied all the keys and values from our
original `.env` files. The only notable difference is that our JSON templates
can use lowercase keys; these will automatically be converted to all-caps.

We can run Genvy as a test to make sure it generates to correct output:

```bash
$ genvy
```

_Note: You can run Genvy from anywhere inside your project; if it cannot_
_find `genvy.json` in the current folder, it will traverse upward until it_
_either finds one, or reaches the filesystem root and errors out._

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 4. Extract Values

One of the whole reasons Genvy exists is to facilitate sharing information
between `.env` files. This is accomplished by extracting common values into
a **`values`** block in the configuration file:

```json
genvy.json

{
  "files": { /* Unchanged */ },
  "values": {
    "db.name": "app_db",
    "db.user": "db_user",
    "db.pass": "guest"
  },
}
```

The `values` block of the configuration file can contain any number of arbitrary
keys, which can then be used in template files to identify the value that
belongs to each.

In our example, the database name, username and password are shared among the two
environments, so these are the ones we've chosen to extract as `db.name`, `db.user`,
and `db.pass`, respectively. And here's how we import them into our templates:

```json
sql/env.json

{
  "postgres_user": { "value": "db.user" },
  "postgres_password": { "value": "db.pass" },
  "postgres_db": { "value": "db.name" }
}
```

```json
backend/env.json

{
  "db_hostname": "localhost",
  "db_username": { "value": "db.user" },
  "db_password": { "value": "db.pass" },
  "db_name": { "value": "db.name" },

  "cookie_validity": 2592000,
  "cookie_secret": "TopSecretCookie"
}
```

Instead of supplying primitive values directly, we used objects with a single
`value` key, which in turn holds one of our previously mentioned identifiers.
Now, if we want to change any of these values across our mutliple `.env` files,
we only need to do it in `genvy.json`.

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 5a. Specify Environment-Specific Values

In most projects, you will run at least two different environments for
development and production (perhaps more for testing, staging, QA, etc).
These environments can have different hostnames, passwords, and other variables.
Genvy can help you keep all these environments and variables organized.

First, add an `environments` key to your configuration file, which should hold
an array containing the names of your planned environments. In our example,
we'll keep it simple, and use only two.

```json
genvy.json

{
  "environments": [ "dev", "prod" ],
  "files": { /* Unchanged */ },
  "values": { /* Unchanged */ }
}
```

Now we can specify environment-specific values in our `values` block, like so:

```json
genvy.json

{
  "environments": [ "dev", "prod" ],
  "files": { /* Unchanged */ },

  "values": {
    "db.name": "app_db",
    "db.user": "db_user",
    "db.pass": {
      "if_env": {
        "dev": "guest",
        "prod": "LongerAndMoreComplexPasswordFor200%Safety!"
      }
    }
  },
}
```

Instead of assigning a primitive, we can assign an object with a single
`if_env` key, which in turn holds an object whose keys correspond to one
of the listed environments. This is what we did here with the `db.pass` value, to
create a more secure password for our production database.

If you're using multiple environments, you need to specify exactly which
one you want to generate when running Genvy:

```bash
$ genvy dev
```

If Genvy finds an `environments` array in the configuration file,
and no environment was specified in the command, it will error out.

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 5b. Specify Environment-Specific Values in Templates

In our environment file for the NodeJS backend, we also included a secret
to sign our cookies with, called `COOKIE_SECRET`. This value is not shared across
the multiple environments (the SQL database has absolutely no use for it),
but we would like to use different secrets for different environments, just
like with our SQL password.

This can be done the exact same way in the template file as in the
configuration file:

```json
backend/env.json

{
  "db_hostname": "localhost",
  "db_username": { "value": "db.user" },
  "db_password": { "value": "db.pass" },
  "db_name": { "value": "db.name" },

  "cookie_validity": 2592000,
  "cookie_secret": {
    "if_env": {
      "dev": "TopSecretCookie",
      "prod": "Topper_Secreter_Cookier"
    }
  }
}
```

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 6. Generate Secure Passwords

A common problem with `.env` files is that they can't be safely committed to a
git repository if they contain sensitive information for the production environment,
such as passwords like above. Genvy can help mitigate this by automatically
generating long, cryptographically secure random passwords at runtime.
This way, you can safely commit all your configuration and template files,
clone the repository to your production environment, and use Genvy there to
generate the passwords for you.

Here's an example of how you can accomplish this:

```json
genvy.json

{
  "environments": [ "dev", "prod" ],
  "files": { /* Unchanged */ },

  "values": {
    "db.name": "app_db",
    "db.user": "db_user",

    "db.pass": {
      "if_env": {
        "dev": "guest",
        "prod": { "secret": 32 }
      },
    }
  },
}
```

In this case, the `db.pass` value in the production environment will be a
32-character random string. You can use the same for the cookie secret
in the `backend/env.json` template:

```json
backend/env.json

{
  "db_hostname": "localhost",
  "db_username": { "value": "db.user" },
  "db_password": { "value": "db.pass" },
  "db_name": { "value": "db.name" },

  "cookie_validity": 2592000,
  "cookie_secret": {
    "if_env": {
      "dev": "TopSecretCookie",
      "prod": { "secret": 32 }
    }
  }
}
```

Besides specifying the length, you can use a few other properties to control
the generated password. These can be found in the
[Value Reference](#value-reference).

You will also notice that, if you use secrets in your configuration or template
files, Genvy will also create a file named `.genvy.secrets` in the same folder
as the configuration file. This file contains all the generated secrets, so that
on subsequent runs (for example, if you expand your app and add a new service
that needs to use one of the existing secrets) it won't generate a new one.

**You SHOULD add `genvy.secrets` to your `.gitignore`.**
[Read more about the secrets file here.](#secrets-file-reference)

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

## 7. Use Expressions

You may have also noticed that our NodeJS environment file contais a key named
`cookie_validity`, with an arbitrary-seeming number value. In this example, we're
using this key to specify our cookies' maximum age in seconds. Unfortunately,
the number `2592000` is not particularly expressive; however, we can replace it
with an expression:

```json
backend/env.json

{
  "db_hostname": "localhost",
  "db_username": { "value": "db.user" },
  "db_password": { "value": "db.pass" },
  "db_name": { "value": "db.name" },

  "cookie_validity": { "expr": "60 * 60 * 24 * 30" },
  "cookie_secret": {
    "if_env": {
      "dev": "TopSecretCookie",
      "prod": { "secret": 32 }
    }
  }
}
```

The `expr` key tells Genvy to evaluate the arithmetic expression that it holds,
and use that as the value. In this case, we specified it as `60 * 60 * 24 * 30`,
which now makes it very clear that our cookies are valid for exactly 30 days.

[Back to Example Walkthrough](#example-walkthrough) - [Back to top](#genvy)

# Configuration Reference

The configuration file is a JSON text file called `genvy.json`. Normally, you
should place it in the root folder of your project, but this is not required.
If you run Genvy from a different location in your folder structure, it will
keep traversing upwards until it either finds a configuration file or reaches
the root directory and errors out.

The configuration file recognizes the following blocks:

## `files`

```json
{
  "files": {
    "<identifier>": {
      "source": "<path to template file>",
      "target": "<path to file to be generated>"
    }
    /* ...etc */
  }
}
```

This block is mandatory. Its keys can be arbitrary identifiers (these currently
hold no significance), each of which should hold an object with two keys:
`source` and `target`. `source` should hold the path to an existing JSON template
file, while `target` should hold the path to the environment file that should be
generated (including the file name). If the file already exists, it will be
overwritten. Relative paths will be appended to the location of the configuration
file.

## `environments`

```json
{
  "environments": [
    "<env_1>",
    "<env_2>"
    /* ...etc */
  ]
}
```

If this is provided, it should be an array of strings that lists the names of
different environments you plan to generate files for. If you do provide an
`environments` block, you MUST specify the name of the environment when you run
Genvy:

```bash
$ genvy dev
```

Otherwise, the script will error out.

## `values`

```json
{
  "values": {
    "<identifier>": "<value definition>"
    /* ...etc */
  }
}
```

The `values` block is used to define values that can then be shared among multiple
environment files. The keys of this block are arbitrary identifiers, each holding
any type of value definition that is recognized by Genvy. For these definitions,
see the [Value Reference](#value-reference).

[Back to top](#genvy)

# Template Reference

```json
{
  "<env_variable_name>": "<value definition>"
  /*  ...etc */
}
```

The keys in a template file are the variable names you want to see in the generated
environment file; the only exception is that they do not have to be all caps, as
Genvy will automatically convert them.

Example:

```json
{
  "db_user": "admin",
  "db_password": "guest"
}
```

Result:

```env
DB_USER=admin
DB_PASSWORD=guest
```

The values assigned to each key can be any of the allowed value definitions.
For these definitions, see the [Value Reference](#value-reference).

[Back to top](#genvy)

# Value Reference

This is a reference of the value definitions allowed in template files, as well
as the `values` block of the configuration file.

1. [Primitives](#primitives)
2. [Named values](#named-values)
3. [Secrets](#secrets)
4. [Expressions](#expressions)
5. [Environment-specific values](#environment-specific-values)

## Primitives

Primitive values will be copied into the environment file as-is, with no changes.

```json
{
  "db_user": "admin",
  "db_port": 5432
}
```

```env
DB_USER=admin
DB_PORT=5432
```

[Back to Value Reference](#value-reference) - [Back to top](#genvy)

## Named values

A named value is an object with a sole `value` key, which MUST hold one of the
identifiers listed in the `values` block of the configuration file.

**Named values are only allowed in template files.**

```json
genvy.json

{
  "values": {
    "db.user": "admin",
  }
}
```

```json
template.json

{
  "db_user": { "value": "db.user" },
}
```

```env
DB_USER=admin
```

[Back to Value Reference](#value-reference) - [Back to top](#genvy)

## Secrets

Secrets can be used to generate cryptographically secure passwords at runtime,
so that you don't have to commit production passwords to your repository.

A secret is an object with a sole `secret` key. In the simplest case, this key
just holds the desired length of the generated password:

```json
{
  "db_password": { "secret": 32 }
}
```

By default, secrets will contain uppercase and lowercase characters, and digits.
To exercise more control over the composition of the secret, you can pass an
array instead of just a number. The first element of the array is the length of
the secret, and subsequent elements define ranges of allowed characters.

For example, this definition generates passwords that consist of lowercase letters
from `a` to `f`, and digits:

```json
{
  "db_password": {
    "secret": [32, "a-f", "0-9"]
  }
}
```

Letters (uppercase and lowercase separately) and numbers can be defined as
ranges using a dash `-`. To allow special characters, include the string `"!"`:

```json
{
  "db_password": {
    "secret": [32, "a-z", "A-Z", "0-9", "!"]
  }
}
```

[Back to Value Reference](#value-reference) - [Back to top](#genvy)

## Expressions

An expression is an object with a sole `expr` key, which must hold an arithmetic
expression as a string. This expression will be evaluated, and its result output
in the environment file.

```json
template.json

{
  "session_length": { "expr": "60 * 60" },
}
```

```env
SESSION_LENGTH=3600
```

Expressions can only contain digits `0-9`, arithmetic operators `+-/*%`, and
parentheses `()`.

[Back to Value Reference](#value-reference) - [Back to top](#genvy)

## Environment-specific values

An environment-specific value is an object with a sole `if_env` key. This key,
must hold an object whose keys correspond to the environment names listed in
the `environments` block of the configuration file. These names, in turn, can
hold any of the above listed value definitions (with the exception that `value`
is still not allowed in the configuration file).

```json
genvy.json

{
  "environments": [
    "dev",
    "prod",
    "test",
    "qa",
  ],
  "values": {
    "default-password": {
      "if_env": {
        "dev": "guest",
        "test": "swordfish"
      }
    }
  }
}
```

```json
template.json

{
  "db.password": {
    "if_env": {
      "dev": { "value": "default-password" },
      "test": { "value": "default-password" },
      "prod": { "secret": 32 },
      "qa": "SpecialPasswordForQA",
    }
  }
}
```

Note that, as shown in the example, environment-specific values can be used
both in the configuration and the template files. Here the `dev` and `test`
environments both refer to the named value `default-password`, which itself
has different values for both environments.

[Back to Value Reference](#value-reference) - [Back to top](#genvy)

# Secrets File Reference

If you use generated secrets in your configuration or template files, Genvy
will create a file named `.genvy.secrets` in the same folder as your
`genvy.json`, and store the generated secrets in it. On subsequent runs,
when it encounters a variable that should be resolved to a generated secret,
it will first check the secrets file if one already exists. If it does,
then Genvy will use the stored secret; if not, it will generate a new one
and store it in the file.

**You SHOULD NOT commit `.genvy.secrets`. You SHOULD add it to `.gitignore`.**

You can also safely edit the secrets file yourself; for example, to add API
keys. Its contents are in JSON like any of the other files. The keys are
composed like so:

**For secrets defined in the configuration file:**

```
<value name>::<environment>
```

**For secrets defined in a template file:**

```
<template name>::<variable name>::<environment>
```

Below are some examples to clarify.

## Example 1

```json
genvy.json

{
  "environments": [ "dev", "prod" ],
  "files": {
    "nodejs": {
      "source": "backend/env.json",
      "target": "backend/.env"
    }
  },
  "values": {
    "db.pass": {
      "if_env": {
        "dev": "guest",
        "prod": { "secret": 32 }
      }
    }
  }
}
```

```json
backend/env.json

{
  "db_user": "admin",
  "db_password": { "value": "db.pass" },

  "cookie_secret": {
    "if_env": {
      "dev": "TopSecretCookie",
      "prod": { "secret": 24 }
    }
  }
}
```

After running `genvy dev`, `.genvy.secrets` will be created; however, it
will just be an empty object (`{}`), since we didn't define any generated
secrets in our `dev` environment.

If now we run `genvy prod`, the file will look something like this:

```json
{
  "db.pass::prod": "abcd1234abcd1234abcd1234abcd1234",
  "nodejs::cookie_secret::prod": "xyz567xyz567xyz567xyz567"
}
```

## Example 2: No environments

If you haven't defined an `environments` block in your configuration,
the environment part of the key will be empty.

```json
genvy.json

{
  "files": {
    "nodejs": {
      "source": "backend/env.json",
      "target": "backend/.env"
    }
  },
  "values": {
    "db.pass": { "secret": 32 }
  }
}
```

```json
backend/env.json

{
  "db_user": "admin",
  "db_password": { "value": "db.pass" },
  "cookie_secret": { "secret": 24 }
}
```

```json
.genvy.secrets

{
  "db.pass::": "abcd1234abcd1234abcd1234abcd1234",
  "nodejs::cookie_secret::": "xyz567xyz567xyz567xyz567"
}
```

## Example 3: Editing the secrets file

Let's say that our backend container uses a 3rd party API that requires an
API key. We'd like to include this API key in the `.env` file, but we'd
rather not include it in the template JSON, since that gets committed to
our repository.

In this case, we can define our template like this:

```json
backend/env.json

{
  "cookie_secret": {
    "if_env": {
      "dev": "TopSecretCookie",
      "prod": { "secret": 24 }
    }
  },
  "api_key": { "secret": 0 }
}
```

_Note: Specifying 0 for the length isn't necessary, but it can be a good_
_way of signaling to yourself or collaborators that this secret isn't expected_
_to be generated._

Then, before running Genvy for the first time, we can create
`.genvy.secrets` ourselves, with the following content:

```json
{
  "nodejs::api_key::dev": "ApiKeyReceivedFrom3rdPartyForDevelopment",
  "nodejs::api_key::prod": "ApiKeyReceivedFrom3rdPartyForProduction"
}
```

Now, when we run Genvy, it will copy the API key from the secrets file,
and generate all the other ones from scratch:

```json
{
  "nodejs::api_key::dev": "ApiKeyReceivedFrom3rdPartyForDevelopment",
  "nodejs::api_key::prod": "ApiKeyReceivedFrom3rdPartyForProduction",
  "nodejs::cookie_secret::prod": "xyz567xyz567xyz567xyz567"
}
```
