Your architecture becomes:

                    YOUR SaaS
                       │
                       ▼
                     Auth0
                  Email/Password
                       │
                       ▼
                  SaaS User
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
      Create GHL Location    Create GHL User
             │                   │
             └─────────┬─────────┘
                       ▼
                 GHL Sub-account
                       │
                       ▼
                  OIDC SSO
                       │
                       ▼
                    Auth0
                       │
                       ▼
              Same SaaS User
1. User signs up

User enters:

Name: Dheeraj Kumar
Email: dheeraj@gmail.com
Password: ********

Auth0 creates:

Auth0 User
────────────────
user_id = auth0|abc123
email = dheeraj@gmail.com
name = Dheeraj Kumar

Your SaaS database stores its own user:

users
────────────────
id = usr_123
auth0_user_id = auth0|abc123
email = dheeraj@gmail.com
first_name = Dheeraj
last_name = Kumar

I'd use your own usr_123 as the stable application user ID.

2. Create their GHL Sub-account

After onboarding/payment:

SaaS User
   ↓
POST /locations/
   ↓
GHL Sub-account

Use the real user's information.

{
  "name": "Dheeraj Kumar",
  "companyId": "YOUR_GHL_AGENCY_ID",
  "email": "dheeraj@gmail.com",
  "country": "IN",
  "timezone": "Asia/Kolkata"
}

GHL returns the new Location/Sub-account ID:

locationId = loc_123

Store:

user_id      = usr_123
location_id  = loc_123
3. Create the same user inside GHL

Now create the actual GHL user:

{
  "companyId": "YOUR_GHL_AGENCY_ID",
  "email": "dheeraj@gmail.com",
  "password": "YOUR_GENERATED_GHL_BOOTSTRAP_PASSWORD",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "loc_123"
  ],
  "firstName": "Dheeraj",
  "lastName": "Kumar",
  "externalUserId": "usr_123"
}

The important fields for your architecture are:

email            → same SaaS user email
firstName        → same SaaS user
lastName         → same SaaS user
locationIds      → newly created GHL location
externalUserId   → your SaaS user ID

# Create Sub-Account (Formerly Location)

POST https://services.leadconnectorhq.com/locations/

<div>
                  <p>Create a new Sub-Account (Formerly Location) based on the data provided</p> 
                  <div>
<span>
                     :::info
 This feature is only available on Agency Pro ($497) plan.
 :::  
 </span>
                  </div>
                </div>
    

## Authentication

**Scopes:** locations.write

**Auth Methods:** OAuth Access Token, Private Integration Token

**Token Types:** Agency Token

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version |

## OpenAPI Specification

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "HighLevel API",
    "version": "2021-07-28"
  },
  "servers": [
    {
      "url": "https://services.leadconnectorhq.com"
    }
  ],
  "paths": {
    "/locations/": {
      "post": {
        "summary": "Create Sub-Account (Formerly Location)",
        "operationId": "createSubaccountFormerlyLocation",
        "description": "<div>\n                  <p>Create a new Sub-Account (Formerly Location) based on the data provided</p> \n                  <div>\n<span>\n                     :::info\n This feature is only available on Agency Pro ($497) plan.\n :::  \n </span>\n                  </div>\n                </div>\n    ",
        "parameters": [
          {
            "name": "Version",
            "in": "header",
            "description": "API Version",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "v3"
              ]
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateLocationDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateLocationSuccessfulResponseDto"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/BadRequestDTO"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnauthorizedDTO"
                }
              }
            }
          }
        },
        "security": [
          {
            "Agency-Access": [
              "locations.write"
            ]
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearer": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access-Only": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account.",
        "type": "http"
      },
      "Agency-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Agency (OR) Private Integration Token of Agency.",
        "type": "http"
      }
    },
    "schemas": {
      "CreateLocationDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "Mark Shoes",
            "description": "The name for the sub-account/location"
          },
          "phone": {
            "type": "string",
            "example": "+1410039940",
            "description": "The phone number of the business for which sub-account is created with the appropriate country-code"
          },
          "companyId": {
            "type": "string",
            "description": "Company/Agency Id",
            "example": "UAXssdawIWAWD"
          },
          "address": {
            "type": "string",
            "example": "4th fleet street",
            "description": "The address of the business for which sub-account is created"
          },
          "city": {
            "type": "string",
            "example": "New York",
            "description": "The city where the business is located for which sub-account is created"
          },
          "state": {
            "type": "string",
            "example": "Illinois",
            "description": "The state in which the business operates for which sub-account is created"
          },
          "country": {
            "type": "string",
            "example": "US",
            "description": "The 2 letter country-code in which the business is present for which sub-account is created",
            "enum": [
              "AF",
              "AX",
              "AL",
              "DZ",
              "AS",
              "AD",
              "AO",
              "AI",
              "AQ",
              "AG",
              "AR",
              "AM",
              "AW",
              "AU",
              "AT",
              "AZ",
              "BS",
              "BH",
              "BD",
              "BB",
              "BY",
              "BE",
              "BZ",
              "BJ",
              "BM",
              "BT",
              "BO",
              "BA",
              "BW",
              "BV",
              "BR",
              "IO",
              "BN",
              "BG",
              "BF",
              "BI",
              "KH",
              "CM",
              "CA",
              "CV",
              "KY",
              "CF",
              "TD",
              "CL",
              "CN",
              "CX",
              "CC",
              "CO",
              "KM",
              "CG",
              "CD",
              "CK",
              "CR",
              "CI",
              "HR",
              "CU",
              "CY",
              "CZ",
              "DK",
              "DJ",
              "DM",
              "DO",
              "EC",
              "EG",
              "SV",
              "GQ",
              "ER",
              "EE",
              "ET",
              "FK",
              "FO",
              "FJ",
              "FI",
              "FR",
              "GF",
              "PF",
              "TF",
              "GA",
              "GM",
              "GE",
              "DE",
              "GH",
              "GI",
              "GR",
              "GL",
              "GD",
              "GP",
              "GU",
              "GT",
              "GG",
              "GN",
              "GW",
              "GY",
              "HT",
              "HM",
              "VA",
              "HN",
              "HK",
              "HU",
              "IS",
              "IN",
              "ID",
              "IR",
              "IQ",
              "IE",
              "IM",
              "IL",
              "IT",
              "JM",
              "JP",
              "JE",
              "JO",
              "KZ",
              "KE",
              "KI",
              "KP",
              "KR",
              "XK",
              "KW",
              "KG",
              "LA",
              "LV",
              "LB",
              "LS",
              "LR",
              "LY",
              "LI",
              "LT",
              "LU",
              "MO",
              "MK",
              "MG",
              "MW",
              "MY",
              "MV",
              "ML",
              "MT",
              "MH",
              "MQ",
              "MR",
              "MU",
              "YT",
              "MX",
              "FM",
              "MD",
              "MC",
              "MN",
              "ME",
              "MS",
              "MA",
              "MZ",
              "MM",
              "NA",
              "NR",
              "NP",
              "NL",
              "AN",
              "NC",
              "NZ",
              "NI",
              "NE",
              "NG",
              "NU",
              "NF",
              "MP",
              "NO",
              "OM",
              "PK",
              "PW",
              "PS",
              "PA",
              "PG",
              "PY",
              "PE",
              "PH",
              "PN",
              "PL",
              "PT",
              "PR",
              "QA",
              "RE",
              "RO",
              "RU",
              "RW",
              "SH",
              "KN",
              "LC",
              "MF",
              "PM",
              "VC",
              "WS",
              "SM",
              "ST",
              "SA",
              "SN",
              "RS",
              "SC",
              "SL",
              "SG",
              "SX",
              "SK",
              "SI",
              "SB",
              "SO",
              "ZA",
              "GS",
              "ES",
              "LK",
              "SD",
              "SR",
              "SJ",
              "SZ",
              "SE",
              "CH",
              "SY",
              "TW",
              "TJ",
              "TZ",
              "TH",
              "TL",
              "TG",
              "TK",
              "TO",
              "TT",
              "TN",
              "TR",
              "TM",
              "TC",
              "TV",
              "UG",
              "GB",
              "UA",
              "AE",
              "US",
              "UM",
              "UY",
              "UZ",
              "VU",
              "VE",
              "VN",
              "VG",
              "VI",
              "WF",
              "EH",
              "YE",
              "ZM",
              "ZW"
            ]
          },
          "postalCode": {
            "type": "string",
            "example": "567654",
            "description": "The postal code of the business for which sub-account is created"
          },
          "website": {
            "type": "string",
            "example": "https://yourwebsite.com",
            "description": "The website of the business for which sub-account is created"
          },
          "timezone": {
            "type": "string",
            "example": "US/Central",
            "description": "The timezone of the business for which sub-account is created"
          },
          "prospectInfo": {
            "example": {
              "firstName": "John",
              "lastName": "Doe",
              "email": "john.doe@mail.com"
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "firstName": {
                    "type": "string",
                    "description": "First name of the prospect",
                    "example": "John"
                  },
                  "lastName": {
                    "type": "string",
                    "description": "Last name of the prospect",
                    "example": "Doe"
                  },
                  "email": {
                    "type": "string",
                    "description": "Email of the prospect",
                    "example": "john.doe@mail.com"
                  }
                },
                "required": [
                  "firstName",
                  "lastName",
                  "email"
                ],
                "title": "ProspectInfoDto"
              }
            ]
          },
          "settings": {
            "description": "The default settings for location",
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "allowDuplicateContact": {
                    "type": "boolean",
                    "example": false
                  },
                  "allowDuplicateOpportunity": {
                    "type": "boolean",
                    "example": false
                  },
                  "allowFacebookNameMerge": {
                    "type": "boolean",
                    "example": false
                  },
                  "disableContactTimezone": {
                    "type": "boolean",
                    "example": false
                  }
                },
                "title": "SettingsSchema"
              }
            ]
          },
          "social": {
            "description": "The social media links for location",
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "facebookUrl": {
                    "type": "string",
                    "description": "Facebook URL",
                    "example": "https://www.facebook.com/"
                  },
                  "googlePlus": {
                    "type": "string",
                    "description": "Googleplus URL",
                    "example": "https://www.googleplus.com/"
                  },
                  "linkedIn": {
                    "type": "string",
                    "description": "LinkedIn URL",
                    "example": "https://www.linkedIn.com/"
                  },
                  "foursquare": {
                    "type": "string",
                    "description": "Foursquare URL",
                    "example": "https://www.foursquare.com/"
                  },
                  "twitter": {
                    "type": "string",
                    "description": "Twitter URL",
                    "example": "https://www.foutwitterrsquare.com/"
                  },
                  "yelp": {
                    "type": "string",
                    "description": "Yelp URL",
                    "example": "https://www.yelp.com/"
                  },
                  "instagram": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.instagram.com/"
                  },
                  "youtube": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.youtube.com/"
                  },
                  "pinterest": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.pinterest.com/"
                  },
                  "blogRss": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.blogRss.com/"
                  },
                  "googlePlacesId": {
                    "type": "string",
                    "description": "Google Business Places ID",
                    "example": "ChIJJGPdVbQTrjsRGUkefteUeFk"
                  }
                },
                "title": "SocialSchema"
              }
            ]
          },
          "twilio": {
            "description": "(DEPRECATED) The twilio credentials for location",
            "deprecated": true,
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "sid": {
                    "type": "string",
                    "description": "SID provided by Twilio",
                    "example": "AC_XXXXXXXXXXX"
                  },
                  "authToken": {
                    "type": "string",
                    "description": "Auth token provided by Twilio",
                    "example": "77_XXXXXXXXXXX"
                  }
                },
                "required": [
                  "sid",
                  "authToken"
                ],
                "title": "TwilioSchema"
              }
            ]
          },
          "mailgun": {
            "description": "The mailgun credentials for location",
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "apiKey": {
                    "type": "string",
                    "description": "API key provided by Mailgun",
                    "example": "key-XXXXXXXXXXX"
                  },
                  "domain": {
                    "type": "string",
                    "description": "Domain connected with Mailgun",
                    "example": "replies.yourdomain.com"
                  }
                },
                "required": [
                  "apiKey",
                  "domain"
                ],
                "title": "MailgunSchema"
              }
            ]
          },
          "snapshotId": {
            "type": "string",
            "description": "The snapshot ID to be loaded into the location.",
            "example": "XXXXXXXXXXX"
          }
        },
        "required": [
          "name",
          "companyId"
        ],
        "title": "CreateLocationDto"
      },
      "CreateLocationSuccessfulResponseDto": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Location Id",
            "example": "ve9EPM428h8vShlRW1KT"
          },
          "companyId": {
            "type": "string",
            "description": "Company/Agency Id",
            "example": "UAXssdawIWAWD"
          },
          "name": {
            "type": "string",
            "example": "Mark Shoes",
            "description": "The name for the sub-account/location"
          },
          "phone": {
            "type": "string",
            "example": "+1410039940",
            "description": "The phone number of the business for which sub-account is created"
          },
          "email": {
            "type": "string",
            "example": "john.doe@mail.com",
            "description": "The email for the sub-account/location"
          },
          "address": {
            "type": "string",
            "example": "4th fleet street",
            "description": "The address of the business for which sub-account is created"
          },
          "city": {
            "type": "string",
            "example": "New York",
            "description": "The city where the business is located for which sub-account is created"
          },
          "state": {
            "type": "string",
            "example": "Illinois",
            "description": "The state in which the business operates for which sub-account is created"
          },
          "domain": {
            "type": "string",
            "example": "test.msgsndr.com"
          },
          "country": {
            "type": "string",
            "example": "US",
            "description": "The country in which the business is present for which sub-account is created",
            "enum": [
              "AF",
              "AX",
              "AL",
              "DZ",
              "AS",
              "AD",
              "AO",
              "AI",
              "AQ",
              "AG",
              "AR",
              "AM",
              "AW",
              "AU",
              "AT",
              "AZ",
              "BS",
              "BH",
              "BD",
              "BB",
              "BY",
              "BE",
              "BZ",
              "BJ",
              "BM",
              "BT",
              "BO",
              "BA",
              "BW",
              "BV",
              "BR",
              "IO",
              "BN",
              "BG",
              "BF",
              "BI",
              "KH",
              "CM",
              "CA",
              "CV",
              "KY",
              "CF",
              "TD",
              "CL",
              "CN",
              "CX",
              "CC",
              "CO",
              "KM",
              "CG",
              "CD",
              "CK",
              "CR",
              "CI",
              "HR",
              "CU",
              "CY",
              "CZ",
              "DK",
              "DJ",
              "DM",
              "DO",
              "EC",
              "EG",
              "SV",
              "GQ",
              "ER",
              "EE",
              "ET",
              "FK",
              "FO",
              "FJ",
              "FI",
              "FR",
              "GF",
              "PF",
              "TF",
              "GA",
              "GM",
              "GE",
              "DE",
              "GH",
              "GI",
              "GR",
              "GL",
              "GD",
              "GP",
              "GU",
              "GT",
              "GG",
              "GN",
              "GW",
              "GY",
              "HT",
              "HM",
              "VA",
              "HN",
              "HK",
              "HU",
              "IS",
              "IN",
              "ID",
              "IR",
              "IQ",
              "IE",
              "IM",
              "IL",
              "IT",
              "JM",
              "JP",
              "JE",
              "JO",
              "KZ",
              "KE",
              "KI",
              "KP",
              "KR",
              "XK",
              "KW",
              "KG",
              "LA",
              "LV",
              "LB",
              "LS",
              "LR",
              "LY",
              "LI",
              "LT",
              "LU",
              "MO",
              "MK",
              "MG",
              "MW",
              "MY",
              "MV",
              "ML",
              "MT",
              "MH",
              "MQ",
              "MR",
              "MU",
              "YT",
              "MX",
              "FM",
              "MD",
              "MC",
              "MN",
              "ME",
              "MS",
              "MA",
              "MZ",
              "MM",
              "NA",
              "NR",
              "NP",
              "NL",
              "AN",
              "NC",
              "NZ",
              "NI",
              "NE",
              "NG",
              "NU",
              "NF",
              "MP",
              "NO",
              "OM",
              "PK",
              "PW",
              "PS",
              "PA",
              "PG",
              "PY",
              "PE",
              "PH",
              "PN",
              "PL",
              "PT",
              "PR",
              "QA",
              "RE",
              "RO",
              "RU",
              "RW",
              "SH",
              "KN",
              "LC",
              "MF",
              "PM",
              "VC",
              "WS",
              "SM",
              "ST",
              "SA",
              "SN",
              "RS",
              "SC",
              "SL",
              "SG",
              "SX",
              "SK",
              "SI",
              "SB",
              "SO",
              "ZA",
              "GS",
              "ES",
              "LK",
              "SD",
              "SR",
              "SJ",
              "SZ",
              "SE",
              "CH",
              "SY",
              "TW",
              "TJ",
              "TZ",
              "TH",
              "TL",
              "TG",
              "TK",
              "TO",
              "TT",
              "TN",
              "TR",
              "TM",
              "TC",
              "TV",
              "UG",
              "GB",
              "UA",
              "AE",
              "US",
              "UM",
              "UY",
              "UZ",
              "VU",
              "VE",
              "VN",
              "VG",
              "VI",
              "WF",
              "EH",
              "YE",
              "ZM",
              "ZW"
            ]
          },
          "postalCode": {
            "type": "string",
            "example": "567654",
            "description": "The postal code of the business for which sub-account is created"
          },
          "website": {
            "type": "string",
            "example": "https://yourwebsite.com",
            "description": "The website of the business for which sub-account is created"
          },
          "timezone": {
            "type": "string",
            "example": "US/Central",
            "description": "The timezone of the business for which sub-account is created"
          },
          "settings": {
            "description": "The default settings for location",
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "allowDuplicateContact": {
                    "type": "boolean",
                    "example": false
                  },
                  "allowDuplicateOpportunity": {
                    "type": "boolean",
                    "example": false
                  },
                  "allowFacebookNameMerge": {
                    "type": "boolean",
                    "example": false
                  },
                  "disableContactTimezone": {
                    "type": "boolean",
                    "example": false
                  }
                },
                "title": "SettingsSchema"
              }
            ]
          },
          "social": {
            "description": "The social media links for location",
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "facebookUrl": {
                    "type": "string",
                    "description": "Facebook URL",
                    "example": "https://www.facebook.com/"
                  },
                  "googlePlus": {
                    "type": "string",
                    "description": "Googleplus URL",
                    "example": "https://www.googleplus.com/"
                  },
                  "linkedIn": {
                    "type": "string",
                    "description": "LinkedIn URL",
                    "example": "https://www.linkedIn.com/"
                  },
                  "foursquare": {
                    "type": "string",
                    "description": "Foursquare URL",
                    "example": "https://www.foursquare.com/"
                  },
                  "twitter": {
                    "type": "string",
                    "description": "Twitter URL",
                    "example": "https://www.foutwitterrsquare.com/"
                  },
                  "yelp": {
                    "type": "string",
                    "description": "Yelp URL",
                    "example": "https://www.yelp.com/"
                  },
                  "instagram": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.instagram.com/"
                  },
                  "youtube": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.youtube.com/"
                  },
                  "pinterest": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.pinterest.com/"
                  },
                  "blogRss": {
                    "type": "string",
                    "description": "Instagram URL",
                    "example": "https://www.blogRss.com/"
                  },
                  "googlePlacesId": {
                    "type": "string",
                    "description": "Google Business Places ID",
                    "example": "ChIJJGPdVbQTrjsRGUkefteUeFk"
                  }
                },
                "title": "SocialSchema"
              }
            ]
          }
        },
        "title": "CreateLocationSuccessfulResponseDto"
      },
      "BadRequestDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 400
          },
          "message": {
            "type": "string",
            "example": "Bad Request"
          }
        },
        "title": "BadRequestDTO"
      },
      "UnauthorizedDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 401
          },
          "message": {
            "type": "string",
            "example": "Invalid token: access token is invalid"
          },
          "error": {
            "type": "string",
            "example": "Unauthorized"
          }
        },
        "title": "UnauthorizedDTO"
      }
    }
  }
}
```

## HighLevel SDK Examples

**Node.js** (`@gohighlevel/api-client`)

```javascript
import HighLevel from '@gohighlevel/api-client';

const ghl = new HighLevel({
  privateIntegrationToken: '<PRIVATE_INTEGRATION_TOKEN>'
});

const body = {
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
};

const response = await ghl.locations.createSubaccountFormerlyLocation(body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "name": "Mark Shoes",
    "phone": "+1410039940",
    "companyId": "UAXssdawIWAWD",
    "address": "4th fleet street",
    "city": "New York",
    "state": "Illinois",
    "country": "US",
    "postalCode": "567654",
    "website": "https://yourwebsite.com",
    "timezone": "US/Central",
    "prospectInfo": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@mail.com"
    },
    "settings": {
        "allowDuplicateContact": false,
        "allowDuplicateOpportunity": false,
        "allowFacebookNameMerge": false,
        "disableContactTimezone": false
    },
    "social": {
        "facebookUrl": "https://www.facebook.com/",
        "googlePlus": "https://www.googleplus.com/",
        "linkedIn": "https://www.linkedIn.com/",
        "foursquare": "https://www.foursquare.com/",
        "twitter": "https://www.foutwitterrsquare.com/",
        "yelp": "https://www.yelp.com/",
        "instagram": "https://www.instagram.com/",
        "youtube": "https://www.youtube.com/",
        "pinterest": "https://www.pinterest.com/",
        "blogRss": "https://www.blogRss.com/",
        "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
    },
    "twilio": {
        "sid": "AC_XXXXXXXXXXX",
        "authToken": "77_XXXXXXXXXXX"
    },
    "mailgun": {
        "apiKey": "key-XXXXXXXXXXX",
        "domain": "replies.yourdomain.com"
    },
    "snapshotId": "XXXXXXXXXXX"
}

response = await client.locations.create_subaccount_formerly_location(body=body)
print(response)
```

**PHP** (`gohighlevel/api-client`)

```php
<?php
require_once 'vendor/autoload.php';

use HighLevel\HighLevel;
use HighLevel\HighLevelConfig;

$config = new HighLevelConfig([
    'privateIntegrationToken' => '<PRIVATE_INTEGRATION_TOKEN>'
]);
$ghl = new HighLevel($config);

$body = [
    'name' => 'Mark Shoes',
    'phone' => '+1410039940',
    'companyId' => 'UAXssdawIWAWD',
    'address' => '4th fleet street',
    'city' => 'New York',
    'state' => 'Illinois',
    'country' => 'US',
    'postalCode' => '567654',
    'website' => 'https://yourwebsite.com',
    'timezone' => 'US/Central',
    'prospectInfo' => [
        'firstName' => 'John',
        'lastName' => 'Doe',
        'email' => 'john.doe@mail.com'
    ],
    'settings' => [
        'allowDuplicateContact' => false,
        'allowDuplicateOpportunity' => false,
        'allowFacebookNameMerge' => false,
        'disableContactTimezone' => false
    ],
    'social' => [
        'facebookUrl' => 'https://www.facebook.com/',
        'googlePlus' => 'https://www.googleplus.com/',
        'linkedIn' => 'https://www.linkedIn.com/',
        'foursquare' => 'https://www.foursquare.com/',
        'twitter' => 'https://www.foutwitterrsquare.com/',
        'yelp' => 'https://www.yelp.com/',
        'instagram' => 'https://www.instagram.com/',
        'youtube' => 'https://www.youtube.com/',
        'pinterest' => 'https://www.pinterest.com/',
        'blogRss' => 'https://www.blogRss.com/',
        'googlePlacesId' => 'ChIJJGPdVbQTrjsRGUkefteUeFk'
    ],
    'twilio' => [
        'sid' => 'AC_XXXXXXXXXXX',
        'authToken' => '77_XXXXXXXXXXX'
    ],
    'mailgun' => [
        'apiKey' => 'key-XXXXXXXXXXX',
        'domain' => 'replies.yourdomain.com'
    ],
    'snapshotId' => 'XXXXXXXXXXX'
];

$response = $ghl->locations->createSubaccountFormerlyLocation($body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X POST 'https://services.leadconnectorhq.com/locations/' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
}'
```

**Node.js**

```javascript
const options = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: 'v3',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "name": "Mark Shoes",
      "phone": "+1410039940",
      "companyId": "UAXssdawIWAWD",
      "address": "4th fleet street",
      "city": "New York",
      "state": "Illinois",
      "country": "US",
      "postalCode": "567654",
      "website": "https://yourwebsite.com",
      "timezone": "US/Central",
      "prospectInfo": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@mail.com"
      },
      "settings": {
        "allowDuplicateContact": false,
        "allowDuplicateOpportunity": false,
        "allowFacebookNameMerge": false,
        "disableContactTimezone": false
      },
      "social": {
        "facebookUrl": "https://www.facebook.com/",
        "googlePlus": "https://www.googleplus.com/",
        "linkedIn": "https://www.linkedIn.com/",
        "foursquare": "https://www.foursquare.com/",
        "twitter": "https://www.foutwitterrsquare.com/",
        "yelp": "https://www.yelp.com/",
        "instagram": "https://www.instagram.com/",
        "youtube": "https://www.youtube.com/",
        "pinterest": "https://www.pinterest.com/",
        "blogRss": "https://www.blogRss.com/",
        "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
      },
      "twilio": {
        "sid": "AC_XXXXXXXXXXX",
        "authToken": "77_XXXXXXXXXXX"
      },
      "mailgun": {
        "apiKey": "key-XXXXXXXXXXX",
        "domain": "replies.yourdomain.com"
      },
      "snapshotId": "XXXXXXXXXXX"
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/locations/', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/locations/"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

payload = {
    "name": "Mark Shoes",
    "phone": "+1410039940",
    "companyId": "UAXssdawIWAWD",
    "address": "4th fleet street",
    "city": "New York",
    "state": "Illinois",
    "country": "US",
    "postalCode": "567654",
    "website": "https://yourwebsite.com",
    "timezone": "US/Central",
    "prospectInfo": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@mail.com"
    },
    "settings": {
        "allowDuplicateContact": false,
        "allowDuplicateOpportunity": false,
        "allowFacebookNameMerge": false,
        "disableContactTimezone": false
    },
    "social": {
        "facebookUrl": "https://www.facebook.com/",
        "googlePlus": "https://www.googleplus.com/",
        "linkedIn": "https://www.linkedIn.com/",
        "foursquare": "https://www.foursquare.com/",
        "twitter": "https://www.foutwitterrsquare.com/",
        "yelp": "https://www.yelp.com/",
        "instagram": "https://www.instagram.com/",
        "youtube": "https://www.youtube.com/",
        "pinterest": "https://www.pinterest.com/",
        "blogRss": "https://www.blogRss.com/",
        "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
    },
    "twilio": {
        "sid": "AC_XXXXXXXXXXX",
        "authToken": "77_XXXXXXXXXXX"
    },
    "mailgun": {
        "apiKey": "key-XXXXXXXXXXX",
        "domain": "replies.yourdomain.com"
    },
    "snapshotId": "XXXXXXXXXXX"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/locations/',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .post("https://services.leadconnectorhq.com/locations/")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .header("Content-Type", "application/json")
  .body("{\"name\":\"Mark Shoes\",\"phone\":\"+1410039940\",\"companyId\":\"UAXssdawIWAWD\",\"address\":\"4th fleet street\",\"city\":\"New York\",\"state\":\"Illinois\",\"country\":\"US\",\"postalCode\":\"567654\",\"website\":\"https://yourwebsite.com\",\"timezone\":\"US/Central\",\"prospectInfo\":{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john.doe@mail.com\"},\"settings\":{\"allowDuplicateContact\":false,\"allowDuplicateOpportunity\":false,\"allowFacebookNameMerge\":false,\"disableContactTimezone\":false},\"social\":{\"facebookUrl\":\"https://www.facebook.com/\",\"googlePlus\":\"https://www.googleplus.com/\",\"linkedIn\":\"https://www.linkedIn.com/\",\"foursquare\":\"https://www.foursquare.com/\",\"twitter\":\"https://www.foutwitterrsquare.com/\",\"yelp\":\"https://www.yelp.com/\",\"instagram\":\"https://www.instagram.com/\",\"youtube\":\"https://www.youtube.com/\",\"pinterest\":\"https://www.pinterest.com/\",\"blogRss\":\"https://www.blogRss.com/\",\"googlePlacesId\":\"ChIJJGPdVbQTrjsRGUkefteUeFk\"},\"twilio\":{\"sid\":\"AC_XXXXXXXXXXX\",\"authToken\":\"77_XXXXXXXXXXX\"},\"mailgun\":{\"apiKey\":\"key-XXXXXXXXXXX\",\"domain\":\"replies.yourdomain.com\"},\"snapshotId\":\"XXXXXXXXXXX\"}")
  .asString();
```

**Go**

```go
package main

import (
  "fmt"
  "net/http"
  "io"
  "strings"
)

func main() {
  url := "https://services.leadconnectorhq.com/locations/"
  payload := strings.NewReader(`{
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
}`)
  req, _ := http.NewRequest("POST", url, payload)
  req.Header.Add("Authorization", "Bearer <TOKEN>")
  req.Header.Add("Version", "v3")

  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}
```

**Ruby**

```ruby
require 'uri'
require 'net/http'

url = URI("https://services.leadconnectorhq.com/locations/")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"
request["Content-Type"] = "application/json"
request.body = '{
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
}'

response = http.request(request)
puts response.read_body
```

**PowerShell**

```powershell
$headers = @{
  "Authorization" = "Bearer <TOKEN>"
  "Version" = "v3"
}

$body = '{
  "name": "Mark Shoes",
  "phone": "+1410039940",
  "companyId": "UAXssdawIWAWD",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@mail.com"
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  },
  "social": {
    "facebookUrl": "https://www.facebook.com/",
    "googlePlus": "https://www.googleplus.com/",
    "linkedIn": "https://www.linkedIn.com/",
    "foursquare": "https://www.foursquare.com/",
    "twitter": "https://www.foutwitterrsquare.com/",
    "yelp": "https://www.yelp.com/",
    "instagram": "https://www.instagram.com/",
    "youtube": "https://www.youtube.com/",
    "pinterest": "https://www.pinterest.com/",
    "blogRss": "https://www.blogRss.com/",
    "googlePlacesId": "ChIJJGPdVbQTrjsRGUkefteUeFk"
  },
  "twilio": {
    "sid": "AC_XXXXXXXXXXX",
    "authToken": "77_XXXXXXXXXXX"
  },
  "mailgun": {
    "apiKey": "key-XXXXXXXXXXX",
    "domain": "replies.yourdomain.com"
  },
  "snapshotId": "XXXXXXXXXXX"
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/locations/' -Method 'POST' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```
# Create User

POST https://services.leadconnectorhq.com/users/

Create User

## Authentication

**Scopes:** users.write, users.write

**Auth Methods:** OAuth Access Token, Private Integration Token

**Token Types:** Agency Token, Sub-Account Token

## Parameters

### Header Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Version` | string | Yes | API Version |

## OpenAPI Specification

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "HighLevel API",
    "version": "2021-07-28"
  },
  "servers": [
    {
      "url": "https://services.leadconnectorhq.com"
    }
  ],
  "paths": {
    "/users/": {
      "post": {
        "summary": "Create User",
        "operationId": "createUser",
        "description": "Create User",
        "parameters": [
          {
            "name": "Version",
            "in": "header",
            "description": "API Version",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "v3"
              ],
              "example": "v3"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateUserDto"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserSuccessfulResponseDto"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/BadRequestDTO"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnauthorizedDTO"
                }
              }
            }
          },
          "422": {
            "description": "Unprocessable Entity",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UnprocessableDTO"
                }
              }
            }
          }
        },
        "security": [
          {
            "Agency-Access": [
              "users.write"
            ]
          },
          {
            "Location-Access": [
              "users.write"
            ]
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearer": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account (OR) Private Integration Token of Sub-Account.",
        "type": "http"
      },
      "Location-Access-Only": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Sub-Account.",
        "type": "http"
      },
      "Agency-Access": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Agency (OR) Private Integration Token of Agency.",
        "type": "http"
      },
      "Agency-Access-Only": {
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "name": "Authorization",
        "in": "header",
        "description": "Use the Access Token generated with user type as Agency.",
        "type": "http"
      }
    },
    "schemas": {
      "CreateUserDto": {
        "type": "object",
        "properties": {
          "companyId": {
            "type": "string",
            "example": "ve9EPM428h8vShlRW1KT",
            "description": "Company/Agency ID to associate the user with"
          },
          "email": {
            "type": "string",
            "example": "john@deo.com",
            "description": "Email address of the user (used for login)"
          },
          "password": {
            "type": "string",
            "example": "************",
            "description": "Password for the user account. All passwords will be required to meet the following criteria:\n\n- Minimum 12 characters\n- At least one uppercase letter (A–Z)\n- At least one lowercase letter (a–z)\n- At least one number (0–9)\n- At least one special character (e.g., !, @, #, $)"
          },
          "phone": {
            "type": "string",
            "example": "+18832327657",
            "description": "Phone number of the user in E.164 format"
          },
          "type": {
            "type": "string",
            "example": "account",
            "description": "User account type (account for sub-account users, agency for agency-level users)"
          },
          "role": {
            "type": "string",
            "example": "admin",
            "description": "User role within the account (admin or user)"
          },
          "locationIds": {
            "example": [
              "C2QujeCh8ZnC7al2InWR"
            ],
            "description": "List of location IDs to assign to the user",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "permissions": {
            "description": "User permissions controlling access to various features",
            "example": {
              "campaignsEnabled": true,
              "campaignsReadOnly": false,
              "contactsEnabled": true,
              "workflowsEnabled": true
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "campaignsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether campaigns are enabled for this user"
                  },
                  "campaignsReadOnly": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether campaigns are in read-only mode for this user"
                  },
                  "contactsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether contacts are enabled for this user"
                  },
                  "workflowsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether workflows are enabled for this user"
                  },
                  "workflowsReadOnly": {
                    "type": "boolean",
                    "example": true,
                    "default": false,
                    "description": "Whether workflows are in read-only mode for this user"
                  },
                  "triggersEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether triggers are enabled for this user"
                  },
                  "funnelsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether funnels are enabled for this user"
                  },
                  "websitesEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether websites are enabled for this user"
                  },
                  "opportunitiesEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether opportunities are enabled for this user"
                  },
                  "dashboardStatsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether dashboard statistics are enabled for this user"
                  },
                  "bulkRequestsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether bulk requests are enabled for this user"
                  },
                  "appointmentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether appointments are enabled for this user"
                  },
                  "reviewsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether reviews are enabled for this user"
                  },
                  "onlineListingsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether online listings are enabled for this user"
                  },
                  "phoneCallEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether phone calls are enabled for this user"
                  },
                  "conversationsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether conversations are enabled for this user"
                  },
                  "assignedDataOnly": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether the user can only access data assigned to them"
                  },
                  "adwordsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether AdWords reporting is enabled for this user"
                  },
                  "membershipEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether membership features are enabled for this user"
                  },
                  "facebookAdsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether Facebook Ads reporting is enabled for this user"
                  },
                  "attributionsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether attributions reporting is enabled for this user"
                  },
                  "settingsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether settings are enabled for this user"
                  },
                  "tagsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether tags are enabled for this user"
                  },
                  "leadValueEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether lead value features are enabled for this user"
                  },
                  "marketingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether marketing features are enabled for this user"
                  },
                  "agentReportingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether agent reporting is enabled for this user"
                  },
                  "botService": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether the bot service is enabled for this user"
                  },
                  "socialPlanner": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether the social planner is enabled for this user"
                  },
                  "bloggingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether blogging is enabled for this user"
                  },
                  "invoiceEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether invoices are enabled for this user"
                  },
                  "affiliateManagerEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether the affiliate manager is enabled for this user"
                  },
                  "contentAiEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether Content AI is enabled for this user"
                  },
                  "refundsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether refunds are enabled for this user"
                  },
                  "recordPaymentEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether recording payments is enabled for this user"
                  },
                  "cancelSubscriptionEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether cancelling subscriptions is enabled for this user"
                  },
                  "paymentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether payments are enabled for this user"
                  },
                  "communitiesEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether communities are enabled for this user"
                  },
                  "exportPaymentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether exporting payments is enabled for this user"
                  }
                },
                "title": "PermissionsDto"
              }
            ]
          },
          "scopes": {
            "type": "array",
            "example": [
              "contacts.write",
              "campaigns.readonly"
            ],
            "description": "Scopes allowed for users. Only scopes that have been passed will be enabled. Note:- If passed empty all the scopes will be get disabled",
            "items": {
              "type": "string",
              "enum": [
                "campaigns.readonly",
                "campaigns.write",
                "calendars.readonly",
                "calendars/events.write",
                "calendars/groups.write",
                "calendars.write",
                "contacts.write",
                "contacts/bulkActions.write",
                "workflows.readonly",
                "workflows.write",
                "triggers.write",
                "funnels.write",
                "forms.write",
                "surveys.write",
                "quizzes.write",
                "websites.write",
                "medias.write",
                "medias.readonly",
                "opportunities.write",
                "opportunities/leadValue.readonly",
                "opportunities/bulkActions.write",
                "pipelines.create",
                "reporting/phone.readonly",
                "reporting/adwords.readonly",
                "reporting/facebookAds.readonly",
                "reporting/attributions.readonly",
                "prospecting/auditReport.write",
                "reporting/reports.readonly",
                "reporting/agent.readonly",
                "reporting/reports.write",
                "reporting/stats.export",
                "payments.write",
                "payments/records.write",
                "payments/orders.readonly",
                "payments/orders.export",
                "payments/orders.import",
                "payments/orders.collectPayment",
                "payments/subscriptions.readonly",
                "payments/subscriptions.write",
                "payments/subscriptions.update",
                "payments/subscriptions.export",
                "payments/subscriptions.pauseResumeCancel",
                "payments/subscriptions.sharePaymentMethod",
                "payments/transactions.readonly",
                "payments/transactions.export",
                "payments/transactions.import",
                "payments/transactions.refund",
                "payments/transactions.viewReceipts",
                "payments/taxesSettings.readonly",
                "payments/settings.readonly",
                "payments/taxesSettings.updateInclusiveExclusive",
                "payments/taxesSettings.manageRates",
                "payments/taxesSettings.configureAutomatic",
                "products.readonly",
                "products.write",
                "products.delete",
                "products.duplicate",
                "products.bulkActions",
                "payments/settings.write",
                "payments/settings.configureReceipt",
                "payments/settings.configureSubscription",
                "invoices.write",
                "invoices.readonly",
                "invoices/schedule.readonly",
                "invoices/schedule.write",
                "invoices/template.readonly",
                "invoices/template.write",
                "reputation/review.write",
                "reputation/listing.write",
                "reputation/reviewsAIAgents.write",
                "reputation/gbp.write",
                "conversations.write",
                "conversations.readonly",
                "conversations/message.readonly",
                "conversations/message.write",
                "contentAI.write",
                "ai-studio.readonly",
                "ai-studio.write",
                "dashboard/stats.readonly",
                "locations/tags.write",
                "locations/tags.readonly",
                "marketing.write",
                "eliza.write",
                "settings.write",
                "socialplanner/post.write",
                "socialplanner/account.readonly",
                "socialplanner/account.write",
                "socialplanner/category.readonly",
                "socialplanner/category.write",
                "socialplanner/csv.readonly",
                "socialplanner/csv.write",
                "socialplanner/group.write",
                "socialplanner/hashtag.readonly",
                "socialplanner/hashtag.write",
                "socialplanner/oauth.readonly",
                "socialplanner/oauth.write",
                "socialplanner/post.readonly",
                "socialplanner/recurring.readonly",
                "socialplanner/recurring.write",
                "socialplanner/review.readonly",
                "socialplanner/review.write",
                "socialplanner/rss.readonly",
                "socialplanner/rss.write",
                "socialplanner/search.readonly",
                "socialplanner/setting.readonly",
                "socialplanner/setting.write",
                "socialplanner/stat.readonly",
                "socialplanner/tag.readonly",
                "socialplanner/tag.write",
                "socialplanner/filters.readonly",
                "socialplanner/medias.readonly",
                "socialplanner/medias.write",
                "socialplanner/watermarks.readonly",
                "socialplanner/watermarks.write",
                "socialplanner/metatag.readonly",
                "socialplanner/facebook.readonly",
                "socialplanner/linkedin.readonly",
                "socialplanner/twitter.readonly",
                "socialplanner/notification.readonly",
                "socialplanner/notification.write",
                "socialplanner/snapshot.readonly",
                "socialplanner/snapshot.write",
                "marketing/affiliate.write",
                "blogs.write",
                "membership.write",
                "communities.write",
                "gokollab.write",
                "certificates.write",
                "certificates.readonly",
                "adPublishing.write",
                "adPublishing.readonly",
                "prospecting.write",
                "prospecting.readonly",
                "prospecting/reports.readonly",
                "private-integration-location.readonly",
                "private-integration-location.write",
                "private-integration-company.readonly",
                "private-integration-company.write",
                "native-integrations.readonly",
                "native-integrations.write",
                "wordpress.write",
                "wordpress.read",
                "custom-menu-link.write",
                "qrcodes.write",
                "users/team-management.write",
                "users/team-management.readonly",
                "loginas.write",
                "users-sso-login-management.write",
                "users-sso-login-management.readonly",
                "sso-config.write",
                "snapshots/api.readonly",
                "snapshots/api.create",
                "snapshots/api.edit",
                "snapshots/api.push",
                "snapshots/api.refresh",
                "snapshots/api.share",
                "snapshots/api.delete",
                "internaltools.location-transfer.write",
                "internaltools.location-transfer.readonly",
                "affiliateportal.write",
                "affiliateportal.readonly",
                "companies.write",
                "internaltools.billing.write",
                "internaltools.billing.readonly",
                "internaltools.billing-common.readonly",
                "internaltools.billing-common.write",
                "voice-ai-agents.write",
                "voice-ai-agents.readonly",
                "voice-ai-common.readonly",
                "voice-ai-common.write",
                "voice-ai-agent-goals.readonly",
                "voice-ai-agent-goals.write",
                "voice-ai-dashboard.readonly",
                "agency/launchpad.write",
                "agency/launchpad.readonly",
                "launchpad/location.write",
                "launchpad/location.readonly",
                "text-ai-agents.write",
                "text-ai-agent-goals.readonly",
                "text-ai-agent-goals.write",
                "text-ai-agent-training.write",
                "text-ai-agents-dashboard.readonly",
                "locations.create",
                "locations.delete",
                "askai.write",
                "copilot.readonly",
                "locations.export.list",
                "locations.features-limits.manage",
                "locations.pause-resume",
                "locations.agency-subaccounts.manage",
                "locations.billing.manage",
                "locations.details.manage",
                "audit-logs.readonly",
                "audit-logs.export"
              ]
            }
          },
          "scopesAssignedToOnly": {
            "type": "array",
            "example": [
              "contacts.write",
              "campaigns.readonly"
            ],
            "description": "Assigned Scopes allowed for users. Only scopes that have been passed will be enabled. If passed empty all the assigned scopes will be get disabled",
            "items": {
              "type": "string",
              "enum": [
                "campaigns.readonly",
                "campaigns.write",
                "calendars.readonly",
                "calendars/events.write",
                "calendars/groups.write",
                "calendars.write",
                "contacts.write",
                "contacts/bulkActions.write",
                "workflows.readonly",
                "workflows.write",
                "triggers.write",
                "funnels.write",
                "forms.write",
                "surveys.write",
                "quizzes.write",
                "websites.write",
                "medias.write",
                "medias.readonly",
                "opportunities.write",
                "opportunities/leadValue.readonly",
                "opportunities/bulkActions.write",
                "pipelines.create",
                "reporting/phone.readonly",
                "reporting/adwords.readonly",
                "reporting/facebookAds.readonly",
                "reporting/attributions.readonly",
                "prospecting/auditReport.write",
                "reporting/reports.readonly",
                "reporting/agent.readonly",
                "reporting/reports.write",
                "reporting/stats.export",
                "payments.write",
                "payments/records.write",
                "payments/orders.readonly",
                "payments/orders.export",
                "payments/orders.import",
                "payments/orders.collectPayment",
                "payments/subscriptions.readonly",
                "payments/subscriptions.write",
                "payments/subscriptions.update",
                "payments/subscriptions.export",
                "payments/subscriptions.pauseResumeCancel",
                "payments/subscriptions.sharePaymentMethod",
                "payments/transactions.readonly",
                "payments/transactions.export",
                "payments/transactions.import",
                "payments/transactions.refund",
                "payments/transactions.viewReceipts",
                "payments/taxesSettings.readonly",
                "payments/settings.readonly",
                "payments/taxesSettings.updateInclusiveExclusive",
                "payments/taxesSettings.manageRates",
                "payments/taxesSettings.configureAutomatic",
                "products.readonly",
                "products.write",
                "products.delete",
                "products.duplicate",
                "products.bulkActions",
                "payments/settings.write",
                "payments/settings.configureReceipt",
                "payments/settings.configureSubscription",
                "invoices.write",
                "invoices.readonly",
                "invoices/schedule.readonly",
                "invoices/schedule.write",
                "invoices/template.readonly",
                "invoices/template.write",
                "reputation/review.write",
                "reputation/listing.write",
                "reputation/reviewsAIAgents.write",
                "reputation/gbp.write",
                "conversations.write",
                "conversations.readonly",
                "conversations/message.readonly",
                "conversations/message.write",
                "contentAI.write",
                "ai-studio.readonly",
                "ai-studio.write",
                "dashboard/stats.readonly",
                "locations/tags.write",
                "locations/tags.readonly",
                "marketing.write",
                "eliza.write",
                "settings.write",
                "socialplanner/post.write",
                "socialplanner/account.readonly",
                "socialplanner/account.write",
                "socialplanner/category.readonly",
                "socialplanner/category.write",
                "socialplanner/csv.readonly",
                "socialplanner/csv.write",
                "socialplanner/group.write",
                "socialplanner/hashtag.readonly",
                "socialplanner/hashtag.write",
                "socialplanner/oauth.readonly",
                "socialplanner/oauth.write",
                "socialplanner/post.readonly",
                "socialplanner/recurring.readonly",
                "socialplanner/recurring.write",
                "socialplanner/review.readonly",
                "socialplanner/review.write",
                "socialplanner/rss.readonly",
                "socialplanner/rss.write",
                "socialplanner/search.readonly",
                "socialplanner/setting.readonly",
                "socialplanner/setting.write",
                "socialplanner/stat.readonly",
                "socialplanner/tag.readonly",
                "socialplanner/tag.write",
                "socialplanner/filters.readonly",
                "socialplanner/medias.readonly",
                "socialplanner/medias.write",
                "socialplanner/watermarks.readonly",
                "socialplanner/watermarks.write",
                "socialplanner/metatag.readonly",
                "socialplanner/facebook.readonly",
                "socialplanner/linkedin.readonly",
                "socialplanner/twitter.readonly",
                "socialplanner/notification.readonly",
                "socialplanner/notification.write",
                "socialplanner/snapshot.readonly",
                "socialplanner/snapshot.write",
                "marketing/affiliate.write",
                "blogs.write",
                "membership.write",
                "communities.write",
                "gokollab.write",
                "certificates.write",
                "certificates.readonly",
                "adPublishing.write",
                "adPublishing.readonly",
                "prospecting.write",
                "prospecting.readonly",
                "prospecting/reports.readonly",
                "private-integration-location.readonly",
                "private-integration-location.write",
                "private-integration-company.readonly",
                "private-integration-company.write",
                "native-integrations.readonly",
                "native-integrations.write",
                "wordpress.write",
                "wordpress.read",
                "custom-menu-link.write",
                "qrcodes.write",
                "users/team-management.write",
                "users/team-management.readonly",
                "loginas.write",
                "users-sso-login-management.write",
                "users-sso-login-management.readonly",
                "sso-config.write",
                "snapshots/api.readonly",
                "snapshots/api.create",
                "snapshots/api.edit",
                "snapshots/api.push",
                "snapshots/api.refresh",
                "snapshots/api.share",
                "snapshots/api.delete",
                "internaltools.location-transfer.write",
                "internaltools.location-transfer.readonly",
                "affiliateportal.write",
                "affiliateportal.readonly",
                "companies.write",
                "internaltools.billing.write",
                "internaltools.billing.readonly",
                "internaltools.billing-common.readonly",
                "internaltools.billing-common.write",
                "voice-ai-agents.write",
                "voice-ai-agents.readonly",
                "voice-ai-common.readonly",
                "voice-ai-common.write",
                "voice-ai-agent-goals.readonly",
                "voice-ai-agent-goals.write",
                "voice-ai-dashboard.readonly",
                "agency/launchpad.write",
                "agency/launchpad.readonly",
                "launchpad/location.write",
                "launchpad/location.readonly",
                "text-ai-agents.write",
                "text-ai-agent-goals.readonly",
                "text-ai-agent-goals.write",
                "text-ai-agent-training.write",
                "text-ai-agents-dashboard.readonly",
                "locations.create",
                "locations.delete",
                "askai.write",
                "copilot.readonly",
                "locations.export.list",
                "locations.features-limits.manage",
                "locations.pause-resume",
                "locations.agency-subaccounts.manage",
                "locations.billing.manage",
                "locations.details.manage",
                "audit-logs.readonly",
                "audit-logs.export"
              ]
            }
          },
          "profilePhoto": {
            "type": "string",
            "example": "https://img.png",
            "description": "URL of the user profile photo"
          },
          "twilioPhone": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "example": {
              "C2QujeCh8ZnC7al2InWR": "+18832327657",
              "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
            },
            "description": "Per-location inbound Twilio number in E.164 format, keyed by location id (Call and Voicemail Inbound Number for direct Twilio, not LC Phone). Replacement semantics: if you send twilioPhone in the request body, the stored map is replaced entirely with this object (not merged). Any location id omitted from the object is removed from the saved map. Omit the twilioPhone property entirely to leave existing numbers unchanged. Send an empty object {} to clear all per-location numbers. To clear a single location only, set that location id to an empty string \"\"."
          },
          "platformLanguage": {
            "type": "string",
            "example": "en_US",
            "description": "Platform language preference for the user",
            "enum": [
              "en_US",
              "es",
              "fr_CA",
              "fr_FR",
              "nl",
              "de",
              "pt_PT",
              "pt_BR",
              "it",
              "sv",
              "da",
              "fi",
              "no"
            ]
          },
          "firstName": {
            "type": "string",
            "example": "John",
            "description": "First name of the user"
          },
          "lastName": {
            "type": "string",
            "example": "Deo",
            "description": "Last name of the user"
          }
        },
        "required": [
          "companyId",
          "email",
          "password",
          "type",
          "role",
          "locationIds",
          "firstName",
          "lastName"
        ],
        "title": "CreateUserDto"
      },
      "UserSuccessfulResponseDto": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "example": "0IHuJvc2ofPAAA8GzTRi",
            "description": "Unique identifier of the user"
          },
          "name": {
            "type": "string",
            "example": "John Deo",
            "description": "Full name of the user"
          },
          "firstName": {
            "type": "string",
            "example": "John",
            "description": "First name of the user"
          },
          "lastName": {
            "type": "string",
            "example": "Deo",
            "description": "Last name of the user"
          },
          "email": {
            "type": "string",
            "example": "john@deo.com",
            "description": "Email address of the user"
          },
          "phone": {
            "type": "string",
            "example": "+1 808-868-8888",
            "description": "Phone number of the user"
          },
          "extension": {
            "type": "string",
            "example": "",
            "description": "Phone extension of the user"
          },
          "permissions": {
            "description": "User permissions controlling access to various features",
            "example": {
              "campaignsEnabled": true,
              "campaignsReadOnly": false,
              "contactsEnabled": true,
              "workflowsEnabled": true
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "campaignsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether campaigns are enabled for this user"
                  },
                  "campaignsReadOnly": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether campaigns are in read-only mode for this user"
                  },
                  "contactsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether contacts are enabled for this user"
                  },
                  "workflowsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether workflows are enabled for this user"
                  },
                  "workflowsReadOnly": {
                    "type": "boolean",
                    "example": true,
                    "default": false,
                    "description": "Whether workflows are in read-only mode for this user"
                  },
                  "triggersEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether triggers are enabled for this user"
                  },
                  "funnelsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether funnels are enabled for this user"
                  },
                  "websitesEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether websites are enabled for this user"
                  },
                  "opportunitiesEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether opportunities are enabled for this user"
                  },
                  "dashboardStatsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether dashboard statistics are enabled for this user"
                  },
                  "bulkRequestsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether bulk requests are enabled for this user"
                  },
                  "appointmentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether appointments are enabled for this user"
                  },
                  "reviewsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether reviews are enabled for this user"
                  },
                  "onlineListingsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether online listings are enabled for this user"
                  },
                  "phoneCallEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether phone calls are enabled for this user"
                  },
                  "conversationsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether conversations are enabled for this user"
                  },
                  "assignedDataOnly": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether the user can only access data assigned to them"
                  },
                  "adwordsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether AdWords reporting is enabled for this user"
                  },
                  "membershipEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether membership features are enabled for this user"
                  },
                  "facebookAdsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether Facebook Ads reporting is enabled for this user"
                  },
                  "attributionsReportingEnabled": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether attributions reporting is enabled for this user"
                  },
                  "settingsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether settings are enabled for this user"
                  },
                  "tagsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether tags are enabled for this user"
                  },
                  "leadValueEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether lead value features are enabled for this user"
                  },
                  "marketingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether marketing features are enabled for this user"
                  },
                  "agentReportingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether agent reporting is enabled for this user"
                  },
                  "botService": {
                    "type": "boolean",
                    "example": false,
                    "default": false,
                    "description": "Whether the bot service is enabled for this user"
                  },
                  "socialPlanner": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether the social planner is enabled for this user"
                  },
                  "bloggingEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether blogging is enabled for this user"
                  },
                  "invoiceEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether invoices are enabled for this user"
                  },
                  "affiliateManagerEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether the affiliate manager is enabled for this user"
                  },
                  "contentAiEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether Content AI is enabled for this user"
                  },
                  "refundsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether refunds are enabled for this user"
                  },
                  "recordPaymentEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether recording payments is enabled for this user"
                  },
                  "cancelSubscriptionEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether cancelling subscriptions is enabled for this user"
                  },
                  "paymentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether payments are enabled for this user"
                  },
                  "communitiesEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether communities are enabled for this user"
                  },
                  "exportPaymentsEnabled": {
                    "type": "boolean",
                    "example": true,
                    "default": true,
                    "description": "Whether exporting payments is enabled for this user"
                  }
                },
                "title": "PermissionsDto"
              }
            ]
          },
          "scopes": {
            "type": "string",
            "description": "List of OAuth scopes granted to this user",
            "example": [
              "contacts.write",
              "campaigns.readonly"
            ],
            "enum": [
              "campaigns.readonly",
              "campaigns.write",
              "calendars.readonly",
              "calendars/events.write",
              "calendars/groups.write",
              "calendars.write",
              "contacts.write",
              "contacts/bulkActions.write",
              "workflows.readonly",
              "workflows.write",
              "triggers.write",
              "funnels.write",
              "forms.write",
              "surveys.write",
              "quizzes.write",
              "websites.write",
              "medias.write",
              "medias.readonly",
              "opportunities.write",
              "opportunities/leadValue.readonly",
              "opportunities/bulkActions.write",
              "pipelines.create",
              "reporting/phone.readonly",
              "reporting/adwords.readonly",
              "reporting/facebookAds.readonly",
              "reporting/attributions.readonly",
              "prospecting/auditReport.write",
              "reporting/reports.readonly",
              "reporting/agent.readonly",
              "reporting/reports.write",
              "reporting/stats.export",
              "payments.write",
              "payments/records.write",
              "payments/orders.readonly",
              "payments/orders.export",
              "payments/orders.import",
              "payments/orders.collectPayment",
              "payments/subscriptions.readonly",
              "payments/subscriptions.write",
              "payments/subscriptions.update",
              "payments/subscriptions.export",
              "payments/subscriptions.pauseResumeCancel",
              "payments/subscriptions.sharePaymentMethod",
              "payments/transactions.readonly",
              "payments/transactions.export",
              "payments/transactions.import",
              "payments/transactions.refund",
              "payments/transactions.viewReceipts",
              "payments/taxesSettings.readonly",
              "payments/settings.readonly",
              "payments/taxesSettings.updateInclusiveExclusive",
              "payments/taxesSettings.manageRates",
              "payments/taxesSettings.configureAutomatic",
              "products.readonly",
              "products.write",
              "products.delete",
              "products.duplicate",
              "products.bulkActions",
              "payments/settings.write",
              "payments/settings.configureReceipt",
              "payments/settings.configureSubscription",
              "invoices.write",
              "invoices.readonly",
              "invoices/schedule.readonly",
              "invoices/schedule.write",
              "invoices/template.readonly",
              "invoices/template.write",
              "reputation/review.write",
              "reputation/listing.write",
              "reputation/reviewsAIAgents.write",
              "reputation/gbp.write",
              "conversations.write",
              "conversations.readonly",
              "conversations/message.readonly",
              "conversations/message.write",
              "contentAI.write",
              "ai-studio.readonly",
              "ai-studio.write",
              "dashboard/stats.readonly",
              "locations/tags.write",
              "locations/tags.readonly",
              "marketing.write",
              "eliza.write",
              "settings.write",
              "socialplanner/post.write",
              "socialplanner/account.readonly",
              "socialplanner/account.write",
              "socialplanner/category.readonly",
              "socialplanner/category.write",
              "socialplanner/csv.readonly",
              "socialplanner/csv.write",
              "socialplanner/group.write",
              "socialplanner/hashtag.readonly",
              "socialplanner/hashtag.write",
              "socialplanner/oauth.readonly",
              "socialplanner/oauth.write",
              "socialplanner/post.readonly",
              "socialplanner/recurring.readonly",
              "socialplanner/recurring.write",
              "socialplanner/review.readonly",
              "socialplanner/review.write",
              "socialplanner/rss.readonly",
              "socialplanner/rss.write",
              "socialplanner/search.readonly",
              "socialplanner/setting.readonly",
              "socialplanner/setting.write",
              "socialplanner/stat.readonly",
              "socialplanner/tag.readonly",
              "socialplanner/tag.write",
              "socialplanner/filters.readonly",
              "socialplanner/medias.readonly",
              "socialplanner/medias.write",
              "socialplanner/watermarks.readonly",
              "socialplanner/watermarks.write",
              "socialplanner/metatag.readonly",
              "socialplanner/facebook.readonly",
              "socialplanner/linkedin.readonly",
              "socialplanner/twitter.readonly",
              "socialplanner/notification.readonly",
              "socialplanner/notification.write",
              "socialplanner/snapshot.readonly",
              "socialplanner/snapshot.write",
              "marketing/affiliate.write",
              "blogs.write",
              "membership.write",
              "communities.write",
              "gokollab.write",
              "certificates.write",
              "certificates.readonly",
              "adPublishing.write",
              "adPublishing.readonly",
              "prospecting.write",
              "prospecting.readonly",
              "prospecting/reports.readonly",
              "private-integration-location.readonly",
              "private-integration-location.write",
              "private-integration-company.readonly",
              "private-integration-company.write",
              "native-integrations.readonly",
              "native-integrations.write",
              "wordpress.write",
              "wordpress.read",
              "custom-menu-link.write",
              "qrcodes.write",
              "users/team-management.write",
              "users/team-management.readonly",
              "loginas.write",
              "users-sso-login-management.write",
              "users-sso-login-management.readonly",
              "sso-config.write",
              "snapshots/api.readonly",
              "snapshots/api.create",
              "snapshots/api.edit",
              "snapshots/api.push",
              "snapshots/api.refresh",
              "snapshots/api.share",
              "snapshots/api.delete",
              "internaltools.location-transfer.write",
              "internaltools.location-transfer.readonly",
              "affiliateportal.write",
              "affiliateportal.readonly",
              "companies.write",
              "internaltools.billing.write",
              "internaltools.billing.readonly",
              "internaltools.billing-common.readonly",
              "internaltools.billing-common.write",
              "voice-ai-agents.write",
              "voice-ai-agents.readonly",
              "voice-ai-common.readonly",
              "voice-ai-common.write",
              "voice-ai-agent-goals.readonly",
              "voice-ai-agent-goals.write",
              "voice-ai-dashboard.readonly",
              "agency/launchpad.write",
              "agency/launchpad.readonly",
              "launchpad/location.write",
              "launchpad/location.readonly",
              "text-ai-agents.write",
              "text-ai-agent-goals.readonly",
              "text-ai-agent-goals.write",
              "text-ai-agent-training.write",
              "text-ai-agents-dashboard.readonly",
              "locations.create",
              "locations.delete",
              "askai.write",
              "copilot.readonly",
              "locations.export.list",
              "locations.features-limits.manage",
              "locations.pause-resume",
              "locations.agency-subaccounts.manage",
              "locations.billing.manage",
              "locations.details.manage",
              "audit-logs.readonly",
              "audit-logs.export"
            ]
          },
          "roles": {
            "description": "Role and access configuration for the user",
            "example": {
              "type": "account",
              "role": "admin",
              "locationIds": [
                "ve9EPM428h8vShlRW1KT"
              ]
            },
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "example": "account",
                    "description": "User account type (account for sub-account users, agency for agency-level users)"
                  },
                  "role": {
                    "type": "string",
                    "example": "admin",
                    "description": "User role within the account (admin or user)"
                  },
                  "locationIds": {
                    "example": [
                      "ve9EPM428h8vShlRW1KT"
                    ],
                    "description": "List of location IDs the user has access to",
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "restrictSubAccount": {
                    "type": "boolean",
                    "example": true,
                    "description": "Whether the user is restricted to specific sub-accounts only"
                  }
                },
                "title": "RoleSchema"
              }
            ]
          },
          "lcPhone": {
            "type": "object",
            "example": {
              "locationId": "+1234556677"
            },
            "description": "LC Phone Inbound Phone Numbers"
          },
          "platformLanguage": {
            "type": "string",
            "example": "en_US",
            "description": "Platform language preference for the user",
            "enum": [
              "en_US",
              "es",
              "fr_CA",
              "fr_FR",
              "nl",
              "de",
              "pt_PT",
              "pt_BR",
              "it",
              "sv",
              "da",
              "fi",
              "no"
            ]
          }
        },
        "title": "UserSuccessfulResponseDto"
      },
      "BadRequestDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 400
          },
          "message": {
            "type": "string",
            "example": "Bad Request"
          }
        },
        "title": "BadRequestDTO"
      },
      "UnauthorizedDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 401
          },
          "message": {
            "type": "string",
            "example": "Invalid token: access token is invalid"
          },
          "error": {
            "type": "string",
            "example": "Unauthorized"
          }
        },
        "title": "UnauthorizedDTO"
      },
      "UnprocessableDTO": {
        "type": "object",
        "properties": {
          "statusCode": {
            "type": "number",
            "example": 422
          },
          "message": {
            "example": [
              "Unprocessable Entity"
            ],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "error": {
            "type": "string",
            "example": "Unprocessable Entity"
          }
        },
        "title": "UnprocessableDTO"
      }
    }
  }
}
```

## HighLevel SDK Examples

**Node.js** (`@gohighlevel/api-client`)

```javascript
import HighLevel from '@gohighlevel/api-client';

const ghl = new HighLevel({
  privateIntegrationToken: '<PRIVATE_INTEGRATION_TOKEN>'
});

const body = {
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
};

const response = await ghl.users.createUser(body);
console.log(response);
```

**Python** (`gohighlevel-api-client`)

```python
from highlevel import HighLevel

client = HighLevel(
    private_integration_token='<PRIVATE_INTEGRATION_TOKEN>'
)

body = {
    "companyId": "ve9EPM428h8vShlRW1KT",
    "email": "john@deo.com",
    "password": "************",
    "phone": "+18832327657",
    "type": "account",
    "role": "admin",
    "locationIds": [
        "C2QujeCh8ZnC7al2InWR"
    ],
    "permissions": {
        "campaignsEnabled": true,
        "campaignsReadOnly": false,
        "contactsEnabled": true,
        "workflowsEnabled": true
    },
    "scopes": [
        "contacts.write",
        "campaigns.readonly"
    ],
    "scopesAssignedToOnly": [
        "contacts.write",
        "campaigns.readonly"
    ],
    "profilePhoto": "https://img.png",
    "twilioPhone": {
        "C2QujeCh8ZnC7al2InWR": "+18832327657",
        "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
    },
    "platformLanguage": "en_US",
    "firstName": "John",
    "lastName": "Deo"
}

response = await client.users.create_user(body=body)
print(response)
```

**PHP** (`gohighlevel/api-client`)

```php
<?php
require_once 'vendor/autoload.php';

use HighLevel\HighLevel;
use HighLevel\HighLevelConfig;

$config = new HighLevelConfig([
    'privateIntegrationToken' => '<PRIVATE_INTEGRATION_TOKEN>'
]);
$ghl = new HighLevel($config);

$body = [
    'companyId' => 've9EPM428h8vShlRW1KT',
    'email' => 'john@deo.com',
    'password' => '************',
    'phone' => '+18832327657',
    'type' => 'account',
    'role' => 'admin',
    'locationIds' => [
        'C2QujeCh8ZnC7al2InWR'
    ],
    'permissions' => [
        'campaignsEnabled' => true,
        'campaignsReadOnly' => false,
        'contactsEnabled' => true,
        'workflowsEnabled' => true
    ],
    'scopes' => [
        'contacts.write',
        'campaigns.readonly'
    ],
    'scopesAssignedToOnly' => [
        'contacts.write',
        'campaigns.readonly'
    ],
    'profilePhoto' => 'https://img.png',
    'twilioPhone' => [
        'C2QujeCh8ZnC7al2InWR' => '+18832327657',
        'M2QrtfVt8ZnC7cv2InDL' => '+18832327657'
    ],
    'platformLanguage' => 'en_US',
    'firstName' => 'John',
    'lastName' => 'Deo'
];

$response = $ghl->users->createUser($body);
echo json_encode($response, JSON_PRETTY_PRINT);
```

## Code Examples

**cURL**

```bash
curl -L -X POST 'https://services.leadconnectorhq.com/users/' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Version: v3' \
  -H 'Content-Type: application/json' \
  --data-raw '{
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
}'
```

**Node.js**

```javascript
const options = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <TOKEN>',
    Version: 'v3',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "companyId": "ve9EPM428h8vShlRW1KT",
      "email": "john@deo.com",
      "password": "************",
      "phone": "+18832327657",
      "type": "account",
      "role": "admin",
      "locationIds": [
        "C2QujeCh8ZnC7al2InWR"
      ],
      "permissions": {
        "campaignsEnabled": true,
        "campaignsReadOnly": false,
        "contactsEnabled": true,
        "workflowsEnabled": true
      },
      "scopes": [
        "contacts.write",
        "campaigns.readonly"
      ],
      "scopesAssignedToOnly": [
        "contacts.write",
        "campaigns.readonly"
      ],
      "profilePhoto": "https://img.png",
      "twilioPhone": {
        "C2QujeCh8ZnC7al2InWR": "+18832327657",
        "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
      },
      "platformLanguage": "en_US",
      "firstName": "John",
      "lastName": "Deo"
  })
};

try {
  const response = await fetch('https://services.leadconnectorhq.com/users/', options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

**Python**

```python
import requests

url = "https://services.leadconnectorhq.com/users/"

headers = {
    "Authorization": "Bearer <TOKEN>",
    "Version": "v3"
}

payload = {
    "companyId": "ve9EPM428h8vShlRW1KT",
    "email": "john@deo.com",
    "password": "************",
    "phone": "+18832327657",
    "type": "account",
    "role": "admin",
    "locationIds": [
        "C2QujeCh8ZnC7al2InWR"
    ],
    "permissions": {
        "campaignsEnabled": true,
        "campaignsReadOnly": false,
        "contactsEnabled": true,
        "workflowsEnabled": true
    },
    "scopes": [
        "contacts.write",
        "campaigns.readonly"
    ],
    "scopesAssignedToOnly": [
        "contacts.write",
        "campaigns.readonly"
    ],
    "profilePhoto": "https://img.png",
    "twilioPhone": {
        "C2QujeCh8ZnC7al2InWR": "+18832327657",
        "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
    },
    "platformLanguage": "en_US",
    "firstName": "John",
    "lastName": "Deo"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

**PHP**

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => 'https://services.leadconnectorhq.com/users/',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer <TOKEN>',
    'Version: v3',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => '{
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
}',
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
```

**Java**

```java
HttpResponse<String> response = Unirest
  .post("https://services.leadconnectorhq.com/users/")
  .header("Authorization", "Bearer <TOKEN>")
  .header("Version", "v3")
  .header("Content-Type", "application/json")
  .body("{\"companyId\":\"ve9EPM428h8vShlRW1KT\",\"email\":\"john@deo.com\",\"password\":\"************\",\"phone\":\"+18832327657\",\"type\":\"account\",\"role\":\"admin\",\"locationIds\":[\"C2QujeCh8ZnC7al2InWR\"],\"permissions\":{\"campaignsEnabled\":true,\"campaignsReadOnly\":false,\"contactsEnabled\":true,\"workflowsEnabled\":true},\"scopes\":[\"contacts.write\",\"campaigns.readonly\"],\"scopesAssignedToOnly\":[\"contacts.write\",\"campaigns.readonly\"],\"profilePhoto\":\"https://img.png\",\"twilioPhone\":{\"C2QujeCh8ZnC7al2InWR\":\"+18832327657\",\"M2QrtfVt8ZnC7cv2InDL\":\"+18832327657\"},\"platformLanguage\":\"en_US\",\"firstName\":\"John\",\"lastName\":\"Deo\"}")
  .asString();
```

**Go**

```go
package main

import (
  "fmt"
  "net/http"
  "io"
  "strings"
)

func main() {
  url := "https://services.leadconnectorhq.com/users/"
  payload := strings.NewReader(`{
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
}`)
  req, _ := http.NewRequest("POST", url, payload)
  req.Header.Add("Authorization", "Bearer <TOKEN>")
  req.Header.Add("Version", "v3")

  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}
```

**Ruby**

```ruby
require 'uri'
require 'net/http'

url = URI("https://services.leadconnectorhq.com/users/")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = "Bearer <TOKEN>"
request["Version"] = "v3"
request["Content-Type"] = "application/json"
request.body = '{
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
}'

response = http.request(request)
puts response.read_body
```

**PowerShell**

```powershell
$headers = @{
  "Authorization" = "Bearer <TOKEN>"
  "Version" = "v3"
}

$body = '{
  "companyId": "ve9EPM428h8vShlRW1KT",
  "email": "john@deo.com",
  "password": "************",
  "phone": "+18832327657",
  "type": "account",
  "role": "admin",
  "locationIds": [
    "C2QujeCh8ZnC7al2InWR"
  ],
  "permissions": {
    "campaignsEnabled": true,
    "campaignsReadOnly": false,
    "contactsEnabled": true,
    "workflowsEnabled": true
  },
  "scopes": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "scopesAssignedToOnly": [
    "contacts.write",
    "campaigns.readonly"
  ],
  "profilePhoto": "https://img.png",
  "twilioPhone": {
    "C2QujeCh8ZnC7al2InWR": "+18832327657",
    "M2QrtfVt8ZnC7cv2InDL": "+18832327657"
  },
  "platformLanguage": "en_US",
  "firstName": "John",
  "lastName": "Deo"
}'

$response = Invoke-RestMethod -Uri 'https://services.leadconnectorhq.com/users/' -Method 'POST' -Headers $headers -Body $body -ContentType 'application/json'
$response | ConvertTo-Json
```


we alreayd GHL_TOKEN With us 