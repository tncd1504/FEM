function Strnod = Stress_Shell_T_RM_v1_1(D_matm,D_matb,D_mats,xg,yg,u)

%% Stress Evaluates the stresses at the Gauss points and smooth the values
%         to the nodes
%
%  Parameters:
%
%    Input, D_matm : Constitutive matrix for membrane forces
%           D_matb : Constitutive matrix for bending moment
%           D_mats : Constitutive matrix for shear force
%           xg     : Local X coordinates of the Gauss points
%           yg     : Local Y coordinates of the Gauss points
%           u      : Nodal displacements
%   
%    Output, Strnod the nodal stress matrix (nnode,nstrs)

  global coordinates;
  global elements;

% Find basic dimensions
  npnod  = size(coordinates,1);        % Number of nodes
  nelem  = size(elements,1);           % Number of elements
  eqnum  = size(15);
  Strnod = zeros(npnod,9);             % Nodal Stresses
    
% Dimension the global matrices.
  Sx  = zeros( nelem , 3 );      % Create array for streses
  Sy  = zeros( nelem , 3 );      % Create array for streses
  Sxy = zeros( nelem , 3 );      % Create array for streses
  Qx  = zeros( nelem , 3 );      % Create array for streses
  Qy  = zeros( nelem , 3 );      % Create array for streses
  Tx  = zeros( nelem , 3 );      % Create array for streses
  Ty  = zeros( nelem , 3 );      % Create array for streses
  Txy = zeros( nelem , 3 );      % Create array for streses

% Element cycle
  for ielem = 1 : nelem
      
    lnods(1:3) = elements(ielem,1:3);
  
    cxyz(1:3,1:3) = coordinates(lnods(1:3),1:3);      % Element coordinates

    Te = Rotation_system_v1_1(cxyz);
    
    ctxy = cxyz*transpose(Te);    % Rotate coordinates to element mid plane
    x = ctxy(1:3,1);              % Use only local x coordinates
    y = ctxy(1:3,2);              % Use only local y coordinates
    
% Find the equation number list for the i-th element
    for i = 1 : 3
      ii = (i-1)*5;
      eqnum(ii+1) = (lnods(i)-1)*5 + 1 ;   % Build the equation number list
      eqnum(ii+2) = (lnods(i)-1)*5 + 2 ;
      eqnum(ii+3) = (lnods(i)-1)*5 + 3 ;
      eqnum(ii+4) = (lnods(i)-1)*5 + 4 ;
      eqnum(ii+5) = (lnods(i)-1)*5 + 5 ;
    end
    
    u_elem(1:15) = u(eqnum(1:15));

    for igs = 1 : 3
      [bmat_b,bmat_s,bmat_m,area] = B_mat_Shell_T_RM_v1_1(x,y,xg(igs),yg(igs),Te); 
         
      Str1 = D_matb*bmat_b*transpose(u_elem);
      Str2 = D_mats*bmat_s*transpose(u_elem);
      Str3 = D_matm*bmat_m*transpose(u_elem);

      Sx(ielem,igs)  = Str1(1);
      Sy(ielem,igs)  = Str1(2);
      Sxy(ielem,igs) = Str1(3);
      Qx(ielem,igs)  = Str2(1);
      Qy(ielem,igs)  = Str2(2);
      Tx(ielem,igs)  = Str3(1);
      Ty(ielem,igs)  = Str3(2);
      Txy(ielem,igs) = Str3(3);

    end
    
  end
  
%
% Smoothing of Shear Nodal Stresses 
%
  for ielem = 1 : nelem
 
    lnods(1:3) = elements(ielem,1:3);
 
    for inod = 1 : 3
      igs = inod;
      Strnod(lnods(inod),1) = Strnod(lnods(inod),1) + Sx(ielem,igs);
      Strnod(lnods(inod),2) = Strnod(lnods(inod),2) + Sy(ielem,igs);
      Strnod(lnods(inod),3) = Strnod(lnods(inod),3) + Sxy(ielem,igs);
      Strnod(lnods(inod),4) = Strnod(lnods(inod),4) + Qx(ielem,igs);
      Strnod(lnods(inod),5) = Strnod(lnods(inod),5) + Qy(ielem,igs);
      Strnod(lnods(inod),6) = Strnod(lnods(inod),6) + Tx(ielem,igs);
      Strnod(lnods(inod),7) = Strnod(lnods(inod),7) + Ty(ielem,igs);
      Strnod(lnods(inod),8) = Strnod(lnods(inod),8) + Txy(ielem,igs);
      Strnod(lnods(inod),9) = Strnod(lnods(inod),9) + 1;
    end
  end
  for i = 1 : npnod
    Strnod(i,1:8) = Strnod(i,1:8)/Strnod(i,9);
  end

