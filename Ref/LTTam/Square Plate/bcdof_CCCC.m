function [bcdof,bcval]=bcdof_CCCC(bc_lef,bc_low,bc_up,bc_rig)
%--------------------------------------------------------------------------
% PURPOSE 
%    DSG Plate problem
%    Finding CCCC boundary condition 
%--------------------------------------------------------------------------
%   Coded by Phung Van Phuc                                                 
%   FOSAT Group – HCMC, Vietnam                                             
%   Email: phucphungvan@gmail.com                                           
%   Last modified: July 2011                                            
%--------------------------------------------------------------------------

%-------------------------------- CCCC ------------------------------------
    bdof_lef=[];bdof_rig=[];
    for i=1:length(bc_lef)
        bdof_lef=[bdof_lef bc_lef(i)*3-2:bc_lef(i)*3];
        bdof_rig=[bdof_rig bc_rig(i)*3-2:bc_rig(i)*3];
    end
    bdof_up=[];bdof_low=[];
    for i=1:length(bc_low)
        bdof_low=[bdof_low bc_low(i)*3-2:bc_low(i)*3];
        bdof_up=[bdof_up bc_up(i)*3-2:bc_up(i)*3];
    end
    bcdof=[bdof_lef bdof_low bdof_up bdof_rig];
    bcval=zeros(length(bcdof),1);