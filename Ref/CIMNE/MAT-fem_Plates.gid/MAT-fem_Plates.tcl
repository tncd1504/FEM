# MAT-fem.tcl  -*- TCL -*-
#---------------------------------------------------------------------------
#This file is written in TCL lenguage 
#For more information about TCL look at: http://www.sunlabs.com/research/tcl/
#
#At least two procs must be in this file:
#
#    InitGIDProject dir - Will be called whenever a project is begun to be used.
#           where dir is the project's directory
#    EndGIDProject - Will be called whenever a project ends to be used.
#
#For more information about GID internals, check the program scripts.
#---------------------------------------------------------------------------


proc MyBitmaps { dir { type "DEFAULT INSIDELEFT"} } {
    global MyBitmapsNames MyBitmapsCommands MyBitmapsHelp MAT-fem_Plates

    set MyBitmapsNames(0) "fix.gif pload.gif uload.gif material.gif \
	    units.gif mesh.gif write.gif"
    set MyBitmapsCommands(0) [list [list -np- GidOpenConditions "Displacement_Constraints"] \
	    [list -np- GidOpenConditions "Point_Loads"] \
	    [list -np- GidOpenConditions "Uniform_Loads"] \
	    [list -np- GidOpenMaterials] \
	    [list -np- GidOpenProblemData] \
	    "Meshing generate" \
	    "File WriteCalcFile" ]
    set MyBitmapsHelp(0) { "Assign Fixed Displacements" "Assign Puntal Loads" \
	    "Assign Uniform Loads" "Assign Material Properties" \
	    "Set Problem Units" "Generate Mesh" "Write MATLAB Input File" }
    
    # prefix values:
    #          Pre        Only active in the preprocessor
    #          Post       Only active in the postprocessor
    #          PrePost    Active Always

    set prefix Pre

    set MAT-fem_Plates(toolbarwin) [CreateOtherBitmaps MyBar "My toolbar" \
	    MyBitmapsNames MyBitmapsCommands \
	    MyBitmapsHelp $dir "MyBitmaps [list $dir]" $type $prefix]
    AddNewToolbar "MAT-fem_Plates bar" ${prefix}MyBarWindowGeom \
	    "MyBitmaps [list $dir]"
}

proc EndMyBitmaps {} {
    global MAT-fem_Plates
    
    ReleaseToolbar "MAT-fem_Plates bar"
    rename MyBitmaps ""
    
    catch { destroy $MAT-fem_Plates(toolbarwin) }
}

proc InitGIDProject { dir } {
    global MenuNames MenuEntries MenuCommands MenuAcceler
    global MenuNamesP MenuEntriesP MenuCommandsP MenuAccelerP

    set num [lsearch $MenuNamesP "View results"]
    if { [GiDVersionCmp 11.0.8] < 0 } {
        WarnWinText [= "This program requires GiD %s or later" 11.0.8]
        return
       }

    Splash $dir

#    foreach i [array names MenuEntriesP $num,*] "unset MenuEntriesP($i)"
#    foreach i [array names MenuCommandsP $num,*] "unset MenuCommandsP($i)"
#    set MenuEntriesP($num) ""
#    set MenuCommandsP($num) "-np- CreatePostProcessMenu %W"

    set ipos [lsearch $MenuNames Help]
    if { $ipos != -1 } {
	set MenuEntries($ipos) [linsert $MenuEntries($ipos) 0 "Help on MAT-fem_Plates"]
	set MenuCommands($ipos) [linsert $MenuCommands($ipos) 0 \
		[list -np- HelpOnMAT-fem_Plates $dir]]
	set MenuAcceler($ipos) [linsert $MenuAcceler($ipos) 0 ""]
	CreateTopMenus
    }
    set ipos [lsearch $MenuNamesP Help]
    if { $ipos != -1 } {
	set MenuEntriesP($ipos) [linsert $MenuEntriesP($ipos) 0 "Help on MAT-fem_Plates"]
	set MenuCommandsP($ipos) [linsert $MenuCommandsP($ipos) 0 \
		[list -np- HelpOnMAT-fem_Plates $dir]]
	set MenuAccelerP($ipos) [linsert $MenuAccelerP($ipos) 0 ""]
    }

    MyBitmaps $dir

    GidChangeDataLabel "Data units" ""
    GidChangeDataLabel "Interval" ""
    GidChangeDataLabel "Conditions" ""
    GidChangeDataLabel "Local Axes" ""
    
    GidAddUserDataOptions "Fixed Displacement" "GidOpenConditions Displacement_Constraints" 2
    GidAddUserDataOptions "Puntual Loads" "GidOpenConditions Puntual_Loads" 3
    GidAddUserDataOptions "Uniform Loads" "GidOpenConditions Uniform_Loads" 4
    GidAddUserDataOptions "Units"         "GidOpenProblemData" 6
    GidAddUserDataOptions "---" "" 7
    
}

proc EndGIDProject {} {
    EndMyBitmaps
}

proc HelpOnMAT-fem_Plates { dir } {

    WarnWin [join [list "To obtain help for MAT-fem_Plates, check the lates news in " \
                        "www.cimne.com/projects/MAT-fem_Plates "]]

}

#  Rutina Modificada para MAT-fem_Plates
#  04 / 9 / 2006
#  Esta rutnia despliega el logo del programa y la version

proc Splash { dir } {
    global GIDDEFAULT

    set VersionNumber "g1.2/P04.08.2010"

    if { [.gid.central.s disable windows] } { return }

    if { [ winfo exist .splash]} {
	destroy .splash
	update
    }

    toplevel .splash
        
    set im [image create photo -file [ file join $dir MAT-fem_Plates-open.gif]]
    set x [expr [winfo screenwidth .splash]/2-[image width $im]/2]
    set y [expr [winfo screenheight .splash]/2-[image height $im]/2]

    wm geom .splash +$x+$y
    wm transient .splash .gid
    wm overrideredirect .splash 1
    pack [label .splash.l -image $im -relief ridge -bd 2]
    
    label .splash.lv -text $VersionNumber -font "times 7"
    place .splash.lv -x 500 -y 253
    bind .splash <1> "destroy .splash"
    bind .splash <KeyPress> "destroy .splash"
    raise .splash .gid
    grab .splash
    focus .splash
    update

    after 70000 "if { [ winfo exist .splash] } { 
	destroy .splash
    }"
}

