// Thanks to @AdOpsInsider for the blog post
// http://www.adopsinsider.com/ad-ops-basics/at-risk-management-%E2%80%93-how-every-ad-ops-department-should-start-their-day/
// which inspired me to write this Chrome Extension

// adsDateDiff counts days differential (float) between dateX and dateY dates
function adsDateDiff(dateX, dateY) {
    return (dateX.getTime() - dateY.getTime()) / (1000 * 60 * 60 * 24);
}

// adsCurrencyToFloat converts FB formatted currency string to float
function adsCurrencyToFloat(currencystring) {
    floatstring = currencystring.replace(/[^0-9]/g,"");
    return floatstring/100;
}

// returns style (bg color) depending on OSI and campaign status (active == 1 or active == 0)
function adsGetOSIStyle(osi, active){
    var green_part = 0;
    var red_part = 0;
    if (osi > 0.7) {
        green_part = 255;
        red_part = 255 - Math.round(255 * (osi - 0.5));
    } else {
        red_part = 255;
        green_part = Math.round(255 * (osi * osi * 2));
    }
    return 'background-color: rgba(' + red_part + ',' + green_part + ', 0, '+ (active*3 + 1)/4 +')';
}

$.noConflict();
jQuery( document ).ready(function( $ ) {
    $("body").bind("DOMSubtreeModified", function(){
        if (($("a.UIPager_Button").length > 0) && ($( "table.root_table th").length > 0)) { // Check if campaigns table and paging control do exist on page
            $( "a.UIPager_Button" ).bind("click", OnModified); // we'll need to rerun calculations in case user moves to other page of campaigns table (a.UIPager_Button click)
            $( "div#actionbar_top" ).bind("DOMSubtreeModified", OnModified); // or in case user does something in #actionbar_top
            $( "table.root_table th" ).bind("click", OnModified); // or if sorting is applied (table.root_table th click)
            $("body").unbind("DOMSubtreeModified");
        }
    });

    OnModified(); // we need this call in case campaigns already loaded (in that case neither of our previous binds will fire right after document ready)

    function OnModified() { // recalculates all OSI values

        if ($("div#actionbar_top div.UIAdmgrDatePicker span.UIActionMenu_Text").text() != 'Lifetime stats'){ // checking if user is viewing something other than Lifetime stats
            // hiding OSI columns
            $(".td_osi_string").remove();
            $(".th_osi_string").remove();

            // returning last_column class to the spent column elements
            $( ".th_spent_string" ).addClass( "last_column" );
            $( ".td_spent_string" ).addClass( "last_column" );
            return true;
        }

        $( "table.root_table th" ).unbind("DOMSubtreeModified", OnModified); // unbinding DOMSubtreeModified event, because we are going to add new column now

        $( ".th_spent_string" ).removeClass( "last_column" ); // fixing spent column styling and
        $( ".td_spent_string" ).removeClass( "last_column" );

        if ($("th.th_osi_string").length == 0) {
            // let's add new OSI column
            $( "table.root_table tr:first" ).append( '<th class="th_osi_string last_column" id="th_osi_string"><span class="hdr_text">OSI<span class="fbGlossaryTip admgrGlossaryTip fbGlossaryTipQ"><a role="button" href="#"><sup>?</sup></a><span class="tip right"><span class="tipTitle">On Schedule Indicator</span><span class="tipBody">Indicator showing which campaigns are delivering fine and which need help.</span><span class="tipArrow"></span></span></span></span></th>' );
        }

        // okay, let's remove all old OSI values from table
        $(".td_osi_string").remove();

        // and now let's iterate through all rows in table except header and total and recalculate OSI for each row
        $('table.root_table tr').not(':first').not('#totals').each(function (){

            // getting today date, start date and end date
            var today = new Date();
            var start_date = new Date($('td.td_time_start_html div:first', this).text());
            console.log("start " + start_date);
            var end_date_text = $('td.td_time_stop_html div:first', this).text();
            end_date_text.trim();
            console.log("end:" + end_date_text + "!");
            if (end_date_text == '') {
                var end_date = false; // Ongoing campaign with no end date
            } else {
                var end_date = new Date(end_date_text);
            }


            // getting budget type
            var budget_type = '';
            if ($('td.td_budget_remaining_string div.subtext', this).text() == 'Lifetime') {
                budget_type = 'lifetime';
            } else {
                budget_type = 'daily';
            }

            // getting budget
            var budget_string = $('td.td_budgetntype_string div.budget_string', this).text();
            if (budget_type == 'lifetime'){
                // in case lifetime budget everything is trivial
                var planned_budget = adsCurrencyToFloat(budget_string);
            } else {
                // if it's daily budget, then we assume that advertiser was going to spend (daily budget) * (end date - start date + 1)
                if (end_date === false) {
                    var planned_budget = adsCurrencyToFloat(budget_string) * (Math.floor(adsDateDiff(today, start_date)) + 1);
                } else {
                    var planned_budget = adsCurrencyToFloat(budget_string) * (Math.floor(adsDateDiff(end_date, start_date)));
                }
            }

            // getting spent amount
            var spent_string = $('td.td_spent_string', this).text();
            var spent = adsCurrencyToFloat(spent_string);

            // if campaign is active, we will apply different styling later
            var active = 0;
            if ($('td.td_campaign_ui_status_html a.uiButton img.icon', this).attr('title') == 'Active') {
                active = 1;
            }

            var osi = 0;
            var style = '';

            // calculating OSI
            if ((end_date == false) || (today > end_date)) {
                osi = spent / planned_budget;
            } else if ((today <= end_date) && (today >= start_date)) {
                osi = spent / adsDateDiff(today, start_date) * (adsDateDiff(end_date, start_date) + 1) / planned_budget;
                style = adsGetOSIStyle(osi, active);
            }

            var percentage = Math.round(osi * 100) + '%';
            if (active) {
                // use bold text, if campaign is active
                percentage = '<b>' + percentage + '</b>';
            }

            $(this).append('<td style="' + style + '" class="td_osi_string last_column divider">' + percentage + '</td>');
        });

        $( "table.root_table th" ).bind("DOMSubtreeModified", OnModified); // returning bind back
    }
});
