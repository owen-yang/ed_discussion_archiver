'use-strict';

var targetPostId = 0;
var displayArchivedPosts = false;

let archivedPostIds = []
let isArchivedPostIdsDirty = false;

chrome.storage.local.get({'archivedPostIds': []}, function(result) {
    archivedPostIds = result.archivedPostIds;
});

// chrome.storage.onChanged.addListener(function(changes, namespace) {
//     for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
//     console.log(
//       `Storage key "${key}" in namespace "${namespace}" changed.`,
//       `Old value was "${oldValue}", new value is "${newValue}".`
//     );
//   }
// });

// This is all for adding an element to the right-click menu for posts nav column
// Add the "Archive" and "Unarchive" menu options
const observer = new MutationObserver(function(mutationList, observer) {
    for (const mutation of mutationList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const popupMenuItems = $('.popup tr.context-menu-item');
            console.log(`Found ${popupMenuItems.length} popupMenuItems`);

            // Check if Archive element already exists
            if (popupMenuItems.filter(function() { return this.id.match(/archive$/); }).length > 0) {
                return;
            }

            const readAll = popupMenuItems.filter(function() { return this.id.match(/readAll$/); });
            if (readAll.length == 0) {
                console.log('No "readAll" element found');
                return;
            }
            if (readAll.length > 1) {
                console.error(`Unexpected number of "readAll" elements: ${readAll.length}`);
                return;
            }

            const intPrefix = (readAll.attr('id').match(/^\d+/) || []).pop();
            if (intPrefix === undefined) {
                console.error(`Unexpected id format of "readAll" element: ${readAll.attr('id')}`);
                return;
            }

            const archive = readAll.clone();
            archive.insertAfter(readAll);
            archive.attr('id', `${intPrefix}-archive`);

            const elems = archive.find('.cmenui-text');
            if (elems.length != 1) {
                console.error(`Unexpected number of "cmenui-text" elements: ${elems.length}`);
                return;
            }
            elems.text(displayArchivedPosts ? 'Unarchive' : 'Archive');

            const style = popupMenuItems.filter(function() { return this.id.match(/-style$/); });
            archive.click(function() {
                console.log(`(Un)archiving postId=${targetPostId}`);
                const shouldArchive = !displayArchivedPosts;
                const idx = archivedPostIds.indexOf(targetPostId);
                const isAlreadyArchived = (idx > -1);
                if (shouldArchive == isAlreadyArchived) {
                    console.log('post is already (un)archived');
                    return;
                }

                if (shouldArchive) {
                    archivedPostIds.push(targetPostId);
                } else {
                    archivedPostIds.splice(idx, 1);
                }
                isArchivedPostIdsDirty = true;

                // $('body').trigger(jQuery.Event('keydown', {which: $.ui.keyCode.ESCAPE}));

                // ESCAPE => 1
                $('.appbar-group.title').each(function() { this.click(); });
                // style.each(function() { this.click(); });
                // window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape', 'code': 'Escape'}));
                // window.dispatchEvent(new KeyboardEvent('keyup', {'key': 'Escape', 'code': 'Escape'}));
            });
        }
    }
});
observer.observe($('body')[0], {childList: true});

setInterval(main, 100);

function main() {
    if (isArchivedPostIdsDirty) {
        isArchivedPostIdsDirty = false;
        chrome.storage.local.set({'archivedPostIds': archivedPostIds});
    }

    $('.dlv-item').each(function(idx) {
        const postIdStr = ($(this).attr('id').match(/\d+$/) || []).pop();
        if (postIdStr === undefined) {
            console.error(`Unknown postId for element: ${$(this).attr('id')}`);
            return;
        }
        const postId = parseInt(postIdStr);
        const isPostArchived = archivedPostIds.includes(postId);
        $(this).css('display', isPostArchived == displayArchivedPosts ? '' : 'none');

        // When we right-click on this post, set targetPostId accordingly so Archive/Unarchive work
        $(this).off('contextmenu');
        $(this).contextmenu(function() {
            targetPostId = postId;
        });
    });

    $('.sbg-body').each(function(idx) {
        // Skip the "Courses" sidebar group, we only want the "Categories" group
        if ($(this).find('span.discuss-category-tag').length === 0) {
            return;
        }

        // Check if Archived was already added, in which case don't add again
        const lastCategory = $(this).children().last();
        if (lastCategory.attr('id') === 'extension-archived-category') {
            return;
        }

        // Assign an id to this sidebar group to make it easier to reference this group later
        $(this).attr('id', 'sbg-categories');

        // If any other category is clicked, clear the Archived category
        $(this).children().off('click');
        $(this).children().click(function() {
            $('#extension-archived-category').removeClass('sbi-active');
            displayArchivedPosts = false;
        });

        const archivedCategory = lastCategory.clone();
        archivedCategory.insertAfter(lastCategory);

        archivedCategory.children('.discuss-category-tag').css('background-color', 'rgb(0, 0, 0)');
        archivedCategory.children('.sbi-content').text('Archived');
        archivedCategory.attr('href', '');
        archivedCategory.attr('id', 'extension-archived-category');

        archivedCategory.click(function(event) {
            event.preventDefault();

            if (archivedCategory.hasClass('sbi-active')) {
                archivedCategory.removeClass('sbi-active');
                displayArchivedPosts = false;
            } else {
                // Clear any other categories that are active before making Archived active
                $('#sbg-categories .sbi-active').each(function() { this.click(); });
                archivedCategory.addClass('sbi-active');
                displayArchivedPosts = true;
            }
        });
    });
}
