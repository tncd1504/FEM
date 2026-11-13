function Strnod = Stress_Plate_Q4_Iso_v1_2(D_matb,D_mats,gauss_x,gauss_y,u)

%% Stress Evaluates the stresses at the Gauss points and smooth the values
%         to the nodes
%
%  Parameters:
%
%    Input, D_matb  : Constitutive matrix for bending moment
%           D_mats  : Constitutive matrix for shear force
%           gauss_x : Local X coordinates of the Gauss points
%           gauss_y : Local Y coordinates of the Gauss points
%           u       : Nodal displacements
%   
%    Output, Strnod the nodal stress matrix (nnode,nstrs)

  global coordinates;
  global elements;
 
% Find basic dimensions
  nelem  = size(elements,1);          % Number of elements
  nnode  = size(elements,2);          % Number of nodes por element
  npnod  = size(coordinates,1);       % Number of nodes
  Strnod = zeros(npnod,6);            % Create array for stresses
  dofpn  = 3;                         % Number of DOF per node
  dofpe  = dofpn*nnode;               % Number of DOF per element
  eqnum  = zeros(dofpe);              % Equation number list

% Shape function matrix for stress extrapolation
  aa = 1 + sqrt(3);
  bb = 1 - sqrt(3);
  mstres = [ aa*aa , aa*bb , bb*bb , aa*bb ;
             bb*aa , aa*aa , aa*bb , bb*bb ;
             bb*bb , aa*bb , aa*aa , bb*aa ;
             aa*bb , bb*bb , bb*aa , aa*aa ]/4;
  
% Element cycle
  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
  
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1);  % Elem. X coordinates
    coor_y(1:nnode) = coordinates(lnods(1:nnode),2);  % Elem. Y coordinates

    a = (coor_x(2) - coor_x(1))/2;
    b = (coor_y(4) - coor_y(1))/2;
    
    if (a == 0)
      a = (coor_x(3) - coor_x(2))/2;
      b = (coor_y(1) - coor_y(2))/2;
      lnods(1) = elements(ielem,2);
      lnods(2) = elements(ielem,3);
      lnods(3) = elements(ielem,4);
      lnods(4) = elements(ielem,1);
    end

    if (a < 0)                            % Adjust the nodal connectivities
      a = abs(a);
      b = abs(b);
      lnods(1) = elements(ielem,3);
      lnods(2) = elements(ielem,4);
      lnods(3) = elements(ielem,1);
      lnods(4) = elements(ielem,2);
    end
    
% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j = 1 : dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j;   % Build the eq. number list
      end
    end
    
% Recover the nodal displacements for the i-th element
    u_elem(1:dofpe) = u(eqnum(1:dofpe));

    for igaus = 1 : 4
      x = gauss_x(igaus);
      y = gauss_y(igaus);

      [bmat_b,~,~] = B_mat_Plate_Q4_Iso_v1_2(x,y,coor_x,coor_y); 

      Str1 = D_matb*bmat_b*transpose(u_elem);
        
      Strx(igaus)  = Str1(1);
      Stry(igaus)  = Str1(2);
      Strxy(igaus) = Str1(3);
    end

    x = 0;
    y = 0;
    [~,bmat_s,~] = B_mat_Plate_Q4_Iso_v1_2(x,y,coor_x,coor_y);
    Str2 = D_mats*bmat_s*transpose(u_elem);
    StrQx(1:4) = Str2(1);
    StrQy(1:4) = Str2(2);

    Str1 = mstres * transpose(Strx) ;
    Strnod(lnods(1:4),1) = Strnod(lnods(1:4),1) + Str1(1:4);
    Str1 = mstres * transpose(Stry) ;
    Strnod(lnods(1:4),2) = Strnod(lnods(1:4),2) + Str1(1:4);
    Str1 = mstres * transpose(Strxy) ;
    Strnod(lnods(1:4),3) = Strnod(lnods(1:4),3) + Str1(1:4);
    Str2 = mstres * transpose(StrQx) ;
    Strnod(lnods(1:4),4) = Strnod(lnods(1:4),4) + Str2(1:4);
    Str2 = mstres * transpose(StrQy) ;
    Strnod(lnods(1:4),5) = Strnod(lnods(1:4),5) + Str2(1:4);
    Strnod(lnods(1:4),6) = Strnod(lnods(1:4),6) + 1;

  end
 
  for i = 1 : npnod
    Strnod(i,1:5) = Strnod(i,1:5)/Strnod(i,6);
  end   
 
