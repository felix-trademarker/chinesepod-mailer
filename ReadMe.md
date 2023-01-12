## Automate Mailing 

### Chinesepod main mailing event
Automate mailing runs every 15 minutes using package [bull](https://www.npmjs.com/package/bull). users are fetch from database **chinesepod_productions.users** and validated
 - email not like chinesepod.com
 - email not like sexymandarin.com
 - updated at not more than 540 days old
 - created at not less than 1 day old 
 - users ID not in table **sz_org_staff**
 - users ID not in table **sz_students**
 - users does not received any automated email from 3 days ago
 - users options within target time 
 - users option keys does not contain in **invalidEmail**, **sign_up_website**
 - users ID not in table **mailing_donotcontact**

All data will be process and put to queue for email events and validate which email to be sent that particular user. 
 
Events that uses promotions will also be updated, promotion records are stored in **chinesepod2015.Promotions**

Email Logs are stored in **chinesepod_logging.email_logs**

## EMAIL EVENTS

**Email Confirmation** triggers when user haven't confirmed it's registered email and account created not more than 180 days old and no email log records for 'email-confirmation-personal'.

**Onboarding Suggestions** triggers when users subscribe in academics and users email has been confirmed and no email log record for 'email-onboarding-suggestions-personal'

**CNY Promotion** triggers when users subscription is 'free' and within set promotion date and user preferences selected promotions subscription and no email log record for 'promotion-cny-<CURRENT YEAR>'

**CNY Promotion - EVE** triggers when users subscription is 'free' and within set promotion date and user preferences selected promotions subscription and no email log record for 'promotion-cny-<CURRENT YEAR>-new-year'

**CNY Promotion - LAST CHANCE** triggers when users subscription is 'free' and within set promotion date and user preferences selected promotions subscription and no email log record for 'promotion-cny-<CURRENT YEAR>-new-year' and email not opened 'promotion-cny-<CURRENT YEAR>' and 'promotion-cny-<CURRENT YEAR>-new-year' 

**Europe Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and users **GEO LOCATION** is within "UK,GB" and current date is within set europe promotional date and no email log record for 'promotion-europe-day-<CURRENT YEAR>'

**ANZAZ Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and users **GEO LOCATION** is within "AU,NZ" and current date is within set anzac promotional date and no email log record for 'promotion-anzac-day-<CURRENT YEAR>'

**Kings Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and users **GEO LOCATION** is within "NL" and current date is within set kings day promotional date and no email log record for 'promotion-kings-day-<CURRENT YEAR>'

**Freedom Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and users **GEO LOCATION** is within "ZA" and current date is within set freedom day promotional date and no email log record for 'promotion-freedom-day-<CURRENT YEAR>'

**Mothers Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set mothers day promotional date and no email log record for 'promotion-mothers-day-<CURRENT YEAR>'

**Dragon Boat Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set dragon boat promotional date and no email log record for 'promotion-dragon-boat-<CURRENT YEAR>'

**Dragon Boat Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set dragon boat promotional date and no email log record for 'promotion-dragon-boat-<CURRENT YEAR>--v1, promotion-dragon-boat-<CURRENT YEAR>--v2'

**Denmark Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set denmark day promotional date and users **GEO LOCATION** is within "DK" and no email log record for 'promotion-danish-constitution-day-<CURRENT YEAR>'

**Sweden Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and users **GEO LOCATION** is within "SE" and no email log record for 'promotion-swedish-national-day-<CURRENT YEAR>'

**US Memorial Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-memorial-day-weekend-<CURRENT YEAR>'

**US Memorial Day Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-memorial-day-weekend-<CURRENT YEAR>-final'

**Canada Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and users **GEO LOCATION** is within "CA" and no email log record for 'promotion-canada-day-<CURRENT YEAR>'

**Canada Day Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and users **GEO LOCATION** is within "CA" and no email log record for 'promotion-canada-day-<CURRENT YEAR>-final'

**Summer Sale** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-summer-sale-<CURRENT YEAR>'

**Labor Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-labor-day-<CURRENT YEAR>'

**Independence Day Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-independence-day-<CURRENT YEAR>'

**Independence Day Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-independence-day-<CURRENT YEAR>-final'

**Golden Week Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-golden-week-<CURRENT YEAR>-initial'

**Golden Week Promotion Followup 1** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-golden-week-<CURRENT YEAR>-followup-1'

**Golden Week Promotion Followup 2** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-golden-week-<CURRENT YEAR>-followup-2'

**Golden Week Promotion Followup 3** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-golden-week-<CURRENT YEAR>-followup-3'

**Golden Week Promotion Followup Final** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-golden-week-<CURRENT YEAR>-followup-final'

**Thanks Giving Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-thanksgiving-<CURRENT YEAR>'

**Black Friday Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-black-friday-<CURRENT YEAR>'

**Cyber Monday Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-cyber-monday-<CURRENT YEAR>'

**Winter Holiday Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-winter-holidays-<CURRENT YEAR>'

**Winter Holiday Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-winter-holidays-<CURRENT YEAR>-follow-up' and email 'promotion-winter-holidays-<CURRENT YEAR>' not opened

**New Year Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-new-year-<CURRENT YEAR>'

**Easter Promotion** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-easter-<CURRENT YEAR>'

**Easter Promotion Followup** triggers when users subscribe in promotions and users email has been confirmed and  current date is within set promotional date and no email log record for 'promotion-easter-<CURRENT YEAR>'

**Inactivity Email** triggers when users subscribe to academic and users email has been confirmed and user data has 'act_prev' and not 'act_curr' and no email log record for 'inactivity-email'

**Cart Abandonment Notification** triggers when users subscribe in promotions and users email has been confirmed and user viewed checkout and viewed date less than 1 day old and not greater than 4 days old and no email log record for 'cart-abandonedment-email-<CURRENT YEAR>-<DATE VIEWED CHECKOUT MONTH>'

**Anniversary Email** triggers when users subscribe in academics and users email has been confirmed and user has studied atlest 5 lessons and no email log record for 'anniversary-email-personal'

**1 Year Anniversary Email** triggers when users subscribe in academics and users email has been confirmed and user account creation is 1 year old and no email log record for 'one-year-anniversary-email-personal'

**88 CHAR Beta Invite** triggers when users subscribe in beta notifications and users email has been confirmed and user has studied characters and no email log record for '88-char-recap-invite'

**LMFM Promotions** triggers when users subscribe in promotions and users email has been confirmed and user level within ['advanced', 'upperInt', 'intermediate'] and no email log record for 'promotion-learn-mandarin-from-movies'

**Decks APP Promotions** triggers when users subscribe in promotions and users email has been confirmed and users subscription is 'premium' and user has recent vocabulary and no email log record for 'promotion-decks-app'

**Decks APP Promotions** triggers when users subscribe in promotions and users email has been confirmed and users subscription is 'premium' and user has recent vocabulary and no email log record for 'promotion-decks-app'


### Chinesepod Video mail event
Automate mailing runs every 5 minutes using package [bull](https://www.npmjs.com/package/bull). users are fetch from database **chinesepod_productions.users** and validated
 - email not like chinesepod.com
 - email not like sexymandarin.com
 - created at not less than 1 day old and not more than 10 days old
 - users ID not in table **sz_org_staff**
 - users ID not in table **sz_students**
 - users does not received any automated email from 3 days ago
 - users ID not in table **mailing_donotcontact**

**Video mailer** triggers when users email has been confirmed and user just recently created and email not in mailing_donotcontact table and no email log record for 'videomailer--automate'.

